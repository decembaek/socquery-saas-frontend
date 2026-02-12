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
  type AgentGroupAlertChannel,
  type AgentAlertOccurrence,
} from '@/lib/api';

type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const groupIdFromQuery = searchParams.get('groupId') || '';

  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [channels, setChannels] = useState<AgentGroupAlertChannel[]>([]);
  const [alertHistory, setAlertHistory] = useState<AgentAlertOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [channelType, setChannelType] = useState<'email' | 'webhook'>('email');
  const [target, setTarget] = useState('');
  const [webhookMethod, setWebhookMethod] = useState<WebhookMethod>('POST');
  const [webhookHeaders, setWebhookHeaders] = useState(
    '{\n  "Content-Type": "application/json"\n}',
  );
  const [webhookBody, setWebhookBody] = useState('{\n  "event": "anomaly"\n}');

  const [editingId, setEditingId] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editMethod, setEditMethod] = useState<WebhookMethod>('POST');
  const [editHeaders, setEditHeaders] = useState(
    '{\n  "Content-Type": "application/json"\n}',
  );
  const [editBody, setEditBody] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const targetPlaceholder =
    channelType === 'email'
      ? 'alert@example.com'
      : 'https://example.com/webhook/socquery';

  const parseHeadersJson = (value: string): Record<string, string> => {
    if (!value.trim()) return {};
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Headers must be a JSON object.');
    }
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'string') {
        throw new Error(`Header "${k}" value must be a string.`);
      }
      result[k] = v;
    }
    return result;
  };

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

  const fetchChannels = useCallback(async (groupId: string) => {
    if (!groupId) {
      setChannels([]);
      return;
    }
    const res = await agentApi.listGroupAlertChannels(groupId);
    setChannels(res.channels);
  }, []);

  const fetchAlertHistory = useCallback(async (groupId: string) => {
    if (!groupId) {
      setAlertHistory([]);
      return;
    }
    const res = await agentApi.listGroupAlerts(groupId, { limit: 50 });
    setAlertHistory(res.alerts);
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
    fetchChannels(selectedGroupId).catch(() =>
      setError('Failed to load alert channels.'),
    );
  }, [fetchChannels, selectedGroupId]);

  useEffect(() => {
    fetchAlertHistory(selectedGroupId).catch(() =>
      setError('Failed to load alert history.'),
    );
  }, [fetchAlertHistory, selectedGroupId]);

  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      setError('Please select a group first.');
      return;
    }
    if (!target.trim()) {
      setError('Please enter email or webhook URL.');
      return;
    }

    let headersPayload: Record<string, string> | undefined;
    if (channelType === 'webhook') {
      try {
        headersPayload = parseHeadersJson(webhookHeaders);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Invalid headers JSON format.',
        );
        return;
      }
    }

    try {
      setSaving(true);
      setError('');
      await agentApi.createGroupAlertChannel(selectedGroupId, {
        type: channelType,
        target: target.trim(),
        webhook_method: channelType === 'webhook' ? webhookMethod : undefined,
        webhook_headers: channelType === 'webhook' ? headersPayload : undefined,
        webhook_body: channelType === 'webhook' ? webhookBody : undefined,
      });
      setTarget('');
      setWebhookMethod('POST');
      setWebhookHeaders('{\n  "Content-Type": "application/json"\n}');
      setWebhookBody('{\n  "event": "anomaly"\n}');
      setNotice('Alert channel added.');
      await fetchChannels(selectedGroupId);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to add alert channel.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (channel: AgentGroupAlertChannel) => {
    setEditingId(channel.id);
    setEditTarget(channel.target);
    setEditMethod((channel.webhook_method || 'POST') as WebhookMethod);
    setEditHeaders(
      channel.webhook_headers || '{\n  "Content-Type": "application/json"\n}',
    );
    setEditBody(channel.webhook_body || '');
  };

  const saveEdit = async (channel: AgentGroupAlertChannel) => {
    if (!selectedGroupId) return;
    if (!editTarget.trim()) {
      setError('Please enter the target (email or URL).');
      return;
    }

    let headersPayload: Record<string, string> | undefined;
    if (channel.type === 'webhook') {
      try {
        headersPayload = parseHeadersJson(editHeaders);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Invalid headers JSON format.',
        );
        return;
      }
    }

    try {
      setError('');
      await agentApi.updateGroupAlertChannel(selectedGroupId, channel.id, {
        target: editTarget.trim(),
        webhook_method: channel.type === 'webhook' ? editMethod : undefined,
        webhook_headers:
          channel.type === 'webhook' ? headersPayload : undefined,
        webhook_body: channel.type === 'webhook' ? editBody : undefined,
      });
      setEditingId('');
      setNotice('Channel settings saved.');
      await fetchChannels(selectedGroupId);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to save channel settings.');
    }
  };

  const toggleChannelEnabled = async (channel: AgentGroupAlertChannel) => {
    if (!selectedGroupId) return;
    try {
      setError('');
      await agentApi.updateGroupAlertChannel(selectedGroupId, channel.id, {
        enabled: channel.enabled === 0,
      });
      setNotice('Alert channel status updated.');
      await fetchChannels(selectedGroupId);
    } catch {
      setError('Failed to update alert channel status.');
    }
  };

  const deleteChannel = async (channelId: string) => {
    if (!selectedGroupId) return;
    if (!confirm('Delete this alert channel?')) return;
    try {
      setError('');
      await agentApi.deleteGroupAlertChannel(selectedGroupId, channelId);
      setNotice('Alert channel deleted.');
      await fetchChannels(selectedGroupId);
    } catch {
      setError('Failed to delete alert channel.');
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
          Alerts for the selected group will be sent via email or webhook.
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
          <form
            onSubmit={handleCreateChannel}
            className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 space-y-3"
          >
            <h3 className="text-[14px] font-semibold text-text-primary">
              Add channel ({selectedGroup.name})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] text-text-secondary">
                  Channel type
                </label>
                <select
                  value={channelType}
                  onChange={(e) =>
                    setChannelType(e.target.value as 'email' | 'webhook')
                  }
                  className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                >
                  <option value="email">Email</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[12px] text-text-secondary">
                  {channelType === 'email' ? 'Email address' : 'Webhook URL'}
                </label>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={targetPlaceholder}
                  className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                />
              </div>
              {channelType === 'webhook' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[12px] text-text-secondary">
                      HTTP Method
                    </label>
                    <select
                      value={webhookMethod}
                      onChange={(e) =>
                        setWebhookMethod(e.target.value as WebhookMethod)
                      }
                      className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[12px] text-text-secondary">
                      Headers (JSON object)
                    </label>
                    <textarea
                      value={webhookHeaders}
                      onChange={(e) => setWebhookHeaders(e.target.value)}
                      className="w-full min-h-[110px] px-3 py-2 text-[13px] font-mono bg-bg-primary border border-border-primary rounded-sm"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[12px] text-text-secondary">
                      Body (optional, string or JSON)
                    </label>
                    <textarea
                      value={webhookBody}
                      onChange={(e) => setWebhookBody(e.target.value)}
                      className="w-full min-h-[120px] px-3 py-2 text-[13px] font-mono bg-bg-primary border border-border-primary rounded-sm"
                    />
                  </div>
                </>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 bg-accent-primary text-white text-[13px] font-medium rounded-sm hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add channel'}
            </button>
          </form>

          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[14px] font-semibold text-text-primary">
              Alert channels
            </div>
            {channels.length === 0 ? (
              <div className="p-4 text-[13px] text-text-tertiary">
                No alert channels configured.
              </div>
            ) : (
              <div className="divide-y divide-border-primary">
                {channels.map((channel) => (
                  <div key={channel.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-text-primary">
                          {channel.type === 'email' ? 'Email' : 'Webhook'}
                        </div>
                        <div className="text-[12px] text-text-tertiary mt-1 break-all">
                          {channel.target}
                        </div>
                        {channel.type === 'webhook' && (
                          <div className="text-[12px] text-text-tertiary mt-1">
                            {channel.webhook_method || 'POST'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] px-2 py-1 rounded-sm ${
                            channel.enabled
                              ? 'bg-accent-success/10 text-accent-success'
                              : 'bg-bg-tertiary text-text-tertiary'
                          }`}
                        >
                          Status: {channel.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleChannelEnabled(channel)}
                          className={`text-[12px] px-2 py-1 rounded-sm border ${
                            channel.enabled
                              ? 'border-accent-warning/40 text-accent-warning hover:bg-accent-warning/10'
                              : 'border-accent-success/40 text-accent-success hover:bg-accent-success/10'
                          }`}
                        >
                          {channel.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(channel)}
                          className="text-[12px] px-2 py-1 rounded-sm border border-border-primary text-text-secondary hover:bg-bg-tertiary"
                        >
                          Configure
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChannel(channel.id)}
                          className="text-[12px] px-2 py-1 rounded-sm border border-accent-danger/30 text-accent-danger hover:bg-accent-danger/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {editingId === channel.id && (
                      <div className="mt-3 p-3 rounded-sm border border-border-primary bg-bg-primary space-y-3">
                        <div className="space-y-1">
                          <label className="text-[12px] text-text-secondary">
                            {channel.type === 'email'
                              ? 'Email address'
                              : 'Webhook URL'}
                          </label>
                          <input
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            className="w-full h-10 px-3 text-[14px] bg-bg-secondary border border-border-primary rounded-sm"
                          />
                        </div>

                        {channel.type === 'webhook' && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[12px] text-text-secondary">
                                HTTP Method
                              </label>
                              <select
                                value={editMethod}
                                onChange={(e) =>
                                  setEditMethod(e.target.value as WebhookMethod)
                                }
                                className="w-full h-10 px-3 text-[14px] bg-bg-secondary border border-border-primary rounded-sm"
                              >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                                <option value="DELETE">DELETE</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[12px] text-text-secondary">
                                Headers (JSON object)
                              </label>
                              <textarea
                                value={editHeaders}
                                onChange={(e) => setEditHeaders(e.target.value)}
                                className="w-full min-h-[100px] px-3 py-2 text-[13px] font-mono bg-bg-secondary border border-border-primary rounded-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[12px] text-text-secondary">
                                Body (optional)
                              </label>
                              <textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                className="w-full min-h-[100px] px-3 py-2 text-[13px] font-mono bg-bg-secondary border border-border-primary rounded-sm"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(channel)}
                            className="h-8 px-3 text-[12px] rounded-sm bg-accent-primary text-white hover:bg-accent-primary-hover"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId('')}
                            className="h-8 px-3 text-[12px] rounded-sm border border-border-primary text-text-secondary hover:bg-bg-tertiary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[14px] font-semibold text-text-primary">
              Recent alerts
            </div>
            {alertHistory.length === 0 ? (
              <div className="p-4 text-[13px] text-text-tertiary">
                No alerts for this group yet.
              </div>
            ) : (
              <div className="divide-y divide-border-primary">
                {alertHistory.map((a) => (
                  <div key={a.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-text-primary truncate">
                          {a.rule_name || a.metric}
                        </div>
                        <div className="text-[12px] text-text-tertiary mt-1 break-all">
                          {a.message || a.anomaly_type}
                        </div>
                        <div className="text-[12px] text-text-tertiary mt-1">
                          Agent: {a.agent_display_name || a.agent_thing_name || a.agent_id}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] px-2 py-1 rounded-sm ${
                            a.severity === 'critical'
                              ? 'bg-accent-danger/10 text-accent-danger'
                              : a.severity === 'warning'
                                ? 'bg-accent-warning/10 text-accent-warning'
                                : 'bg-accent-info/10 text-accent-info'
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[11px] px-2 py-1 rounded-sm bg-bg-tertiary text-text-secondary">
                          {new Date(a.created_at * 1000).toLocaleString('en-US')}
                        </span>
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
