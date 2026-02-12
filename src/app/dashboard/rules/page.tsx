'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ApiError,
  agentApi,
  type AgentGroup,
  type AgentGroupRule,
} from '@/lib/api';

type RuleFormState = {
  ruleName: string;
  ruleMetric: string;
  ruleOperator: string;
  ruleThreshold: string;
  ruleSeverity: 'info' | 'warning' | 'critical';
  ruleWindow: number;
};

type RuleTemplate = {
  id: string;
  title: string;
  description: string;
  form: RuleFormState;
};

const METRIC_OPTIONS = [
  { value: 'cpu', label: 'CPU usage (%)', thresholdHint: 'e.g. 90' },
  { value: 'memory', label: 'Memory usage (%)', thresholdHint: 'e.g. 90' },
  { value: 'disk', label: 'Disk usage (%)', thresholdHint: 'e.g. 95' },
  {
    value: 'process',
    label: 'Process status',
    thresholdHint: 'e.g. offline, missing',
  },
  {
    value: 'network',
    label: 'Network status',
    thresholdHint: 'e.g. disconnected, fail',
  },
  { value: 'usb', label: 'USB device change', thresholdHint: 'e.g. removed, added' },
] as const;

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'cpu-spike-90-30s',
    title: 'CPU spike',
    description: 'CPU usage >= 90% for 30s or longer',
    form: {
      ruleName: 'CPU > 90% (30s)',
      ruleMetric: 'cpu',
      ruleOperator: '>=',
      ruleThreshold: '90',
      ruleSeverity: 'warning',
      ruleWindow: 30,
    },
  },
  {
    id: 'memory-high-90-300s',
    title: 'Memory high',
    description: 'Memory usage >= 90% for 5min or longer',
    form: {
      ruleName: 'Memory > 90% (5m)',
      ruleMetric: 'memory',
      ruleOperator: '>=',
      ruleThreshold: '90',
      ruleSeverity: 'warning',
      ruleWindow: 300,
    },
  },
  {
    id: 'disk-critical-95-60s',
    title: 'Disk threshold',
    description: 'Disk usage >= 95% for 60s or longer',
    form: {
      ruleName: 'Disk > 95% (60s)',
      ruleMetric: 'disk',
      ruleOperator: '>=',
      ruleThreshold: '95',
      ruleSeverity: 'critical',
      ruleWindow: 60,
    },
  },
  {
    id: 'network-disconnected',
    title: 'Network disconnected',
    description: 'Trigger when network status is disconnected',
    form: {
      ruleName: 'Network disconnected',
      ruleMetric: 'network',
      ruleOperator: '==',
      ruleThreshold: 'disconnected',
      ruleSeverity: 'critical',
      ruleWindow: 1,
    },
  },
  {
    id: 'usb-removed',
    title: 'USB device removed',
    description: 'Trigger when critical USB device is removed',
    form: {
      ruleName: 'USB removed',
      ruleMetric: 'usb',
      ruleOperator: '==',
      ruleThreshold: 'removed',
      ruleSeverity: 'critical',
      ruleWindow: 1,
    },
  },
];

const INITIAL_FORM: RuleFormState = {
  ruleName: '',
  ruleMetric: 'cpu',
  ruleOperator: '>=',
  ruleThreshold: '90',
  ruleSeverity: 'warning',
  ruleWindow: 60,
};

export default function RulesPage() {
  const searchParams = useSearchParams();
  const groupIdFromQuery = searchParams.get('groupId') || '';

  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [rules, setRules] = useState<AgentGroupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState<RuleFormState>(INITIAL_FORM);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const selectedMetric = useMemo(
    () => METRIC_OPTIONS.find((m) => m.value === form.ruleMetric),
    [form.ruleMetric],
  );

  const previewText = useMemo(
    () =>
      `Alert ${form.ruleSeverity} when ${form.ruleMetric} ${form.ruleOperator} ${form.ruleThreshold} for ${form.ruleWindow}s or longer`,
    [
      form.ruleMetric,
      form.ruleOperator,
      form.ruleThreshold,
      form.ruleSeverity,
      form.ruleWindow,
    ],
  );

  const fetchGroups = useCallback(async () => {
    const res = await agentApi.listGroups();
    setGroups(res.groups);

    if (res.groups.length === 0) {
      setSelectedGroupId('');
      return;
    }

    if (groupIdFromQuery && res.groups.some((g) => g.id === groupIdFromQuery)) {
      setSelectedGroupId(groupIdFromQuery);
      return;
    }

    setSelectedGroupId((prev) =>
      prev && res.groups.some((g) => g.id === prev) ? prev : res.groups[0].id,
    );
  }, [groupIdFromQuery]);

  const fetchRules = useCallback(async (groupId: string) => {
    if (!groupId) {
      setRules([]);
      return;
    }
    const res = await agentApi.listGroupRules(groupId);
    setRules(res.rules);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchGroups();
      } catch {
        setError('Failed to load groups.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchGroups]);

  useEffect(() => {
    fetchRules(selectedGroupId).catch(() =>
      setError('Failed to load rules.'),
    );
  }, [fetchRules, selectedGroupId]);

  const applyTemplate = (template: RuleTemplate) => {
    setForm(template.form);
    setNotice(`Template applied: ${template.title}`);
    setError('');
  };

  const handleCreateRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      setError('Please select a group first.');
      return;
    }
    if (!form.ruleName.trim()) {
      setError('Please enter a rule name.');
      return;
    }
    if (!form.ruleThreshold.trim()) {
      setError('Please enter a threshold.');
      return;
    }
    if (form.ruleWindow < 1 || Number.isNaN(form.ruleWindow)) {
      setError('Window must be at least 1 second.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await agentApi.createGroupRule(selectedGroupId, {
        name: form.ruleName.trim(),
        metric: form.ruleMetric,
        operator: form.ruleOperator,
        threshold: form.ruleThreshold.trim(),
        severity: form.ruleSeverity,
        window_seconds: form.ruleWindow,
      });
      setForm((prev) => ({
        ...prev,
        ruleName: '',
      }));
      setNotice('Rule added.');
      await fetchRules(selectedGroupId);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to create rule.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleEnabled = async (rule: AgentGroupRule) => {
    if (!selectedGroupId) return;
    try {
      setError('');
      await agentApi.updateGroupRule(selectedGroupId, rule.id, {
        enabled: rule.enabled === 0,
      });
      setNotice(`Rule updated: ${rule.name}`);
      await fetchRules(selectedGroupId);
    } catch {
      setError('Failed to update rule.');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!selectedGroupId) return;
    if (!confirm('Delete this rule?')) return;
    try {
      setError('');
      await agentApi.deleteGroupRule(selectedGroupId, ruleId);
      setNotice('Rule deleted.');
      await fetchRules(selectedGroupId);
    } catch {
      setError('Failed to delete rule.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-sm bg-accent-danger/10 border border-accent-danger/20 text-[13px] text-accent-danger">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-sm bg-accent-success/10 border border-accent-success/20 text-[13px] text-accent-success">
          {notice}
        </div>
      )}

      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 space-y-3">
        <h3 className="text-[14px] font-semibold text-text-primary">
          Target group
        </h3>
        <p className="text-[12px] text-text-tertiary">
          Rules apply to all agents in the selected group.
        </p>
        {loading ? (
          <div className="text-[13px] text-text-tertiary">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-text-tertiary">
            No groups yet. Create a group in{' '}
            <span className="text-text-primary">Groups</span> first.
          </div>
        ) : (
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full md:w-[360px] h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedGroup ? (
        <>
          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4">
            <h3 className="text-[14px] font-semibold text-text-primary mb-3">
              Quick templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {RULE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="text-left p-3 rounded-sm border border-border-primary hover:bg-bg-tertiary/40 transition-colors"
                >
                  <div className="text-[13px] font-medium text-text-primary">
                    {template.title}
                  </div>
                  <div className="text-[12px] text-text-tertiary mt-1">
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateRule}
            className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 space-y-3"
          >
            <h3 className="text-[14px] font-semibold text-text-primary">
              Add rule ({selectedGroup.name})
            </h3>
            <p className="text-[12px] text-text-tertiary">
              Threshold can be numeric or string (e.g. 90, disconnected, removed).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Rule name
                </label>
                <input
                  value={form.ruleName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ruleName: e.target.value }))
                  }
                  placeholder="e.g. CPU spike"
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Metric
                </label>
                <select
                  value={form.ruleMetric}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ruleMetric: e.target.value }))
                  }
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                >
                  {METRIC_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Operator
                </label>
                <select
                  value={form.ruleOperator}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ruleOperator: e.target.value,
                    }))
                  }
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                >
                  <option value=">=">{'>='}</option>
                  <option value=">">{'>'}</option>
                  <option value="<=">{'<='}</option>
                  <option value="<">{'<'}</option>
                  <option value="==">{'=='}</option>
                  <option value="!=">{'!='}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Threshold
                </label>
                <input
                  value={form.ruleThreshold}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ruleThreshold: e.target.value,
                    }))
                  }
                  placeholder={selectedMetric?.thresholdHint || 'e.g. 90'}
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Severity
                </label>
                <select
                  value={form.ruleSeverity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ruleSeverity: e.target.value as
                        | 'info'
                        | 'warning'
                        | 'critical',
                    }))
                  }
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                >
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="critical">critical</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Window (seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.ruleWindow}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ruleWindow: Number(e.target.value),
                    }))
                  }
                  placeholder="e.g. 60"
                  className="h-10 w-full px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                />
              </div>
            </div>

            <div className="rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-[12px] text-text-secondary">
              <span className="text-text-tertiary mr-2">Preview</span>
              {previewText}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 bg-accent-primary text-white text-[13px] font-medium rounded-sm hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add rule'}
            </button>
          </form>

          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[14px] font-semibold text-text-primary">
              Active rules
            </div>
            {rules.length === 0 ? (
              <div className="p-4 text-[13px] text-text-tertiary">
                No rules yet. Add one using a template above or the form.
              </div>
            ) : (
              <div className="divide-y divide-border-primary">
                {rules.map((rule) => (
                  <div key={rule.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-text-primary truncate">
                          {rule.name}
                        </div>
                        <div className="text-[12px] text-text-tertiary mt-1">
                          {rule.metric} {rule.operator} {rule.threshold} /{' '}
                          {rule.window_seconds}s
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] px-2 py-1 rounded-sm ${
                            rule.severity === 'critical'
                              ? 'bg-accent-danger/10 text-accent-danger'
                              : rule.severity === 'warning'
                                ? 'bg-accent-warning/10 text-accent-warning'
                                : 'bg-accent-info/10 text-accent-info'
                          }`}
                        >
                          {rule.severity}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-1 rounded-sm ${
                            rule.enabled
                              ? 'bg-accent-success/10 text-accent-success'
                              : 'bg-bg-tertiary text-text-tertiary'
                          }`}
                        >
                          Status: {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRuleEnabled(rule)}
                          aria-label={
                            rule.enabled
                              ? 'Disable rule'
                              : 'Enable rule'
                          }
                          className={`text-[12px] px-2 py-1 rounded-sm border ${
                            rule.enabled
                              ? 'border-accent-warning/40 text-accent-warning hover:bg-accent-warning/10'
                              : 'border-accent-success/40 text-accent-success hover:bg-accent-success/10'
                          }`}
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="text-[12px] px-2 py-1 rounded-sm border border-accent-danger/30 text-accent-danger hover:bg-accent-danger/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
