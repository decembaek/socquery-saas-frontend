'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  agentApi,
  type Agent,
  type AgentGroup,
} from '@/lib/api';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<AgentGroup | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<
    'store' | 'region' | 'device_type' | 'customer'
  >('store');

  const fetchAll = useCallback(async () => {
    const [groupRes, agentsRes] = await Promise.all([
      agentApi.getGroup(groupId),
      agentApi.list({ group_id: groupId, limit: 200 }),
    ]);
    setGroup(groupRes.group);
    setName(groupRes.group.name);
    setCategory(groupRes.group.category);
    setDescription(groupRes.group.description || '');
    setAgents(agentsRes.agents);
  }, [groupId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchAll();
      } catch {
        setError('Failed to load group.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchAll]);

  const saveGroup = async () => {
    try {
      setSaving(true);
      await agentApi.updateGroup(groupId, { name, category, description });
      await fetchAll();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to update group.');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!confirm('Delete this group? Agents in this group will be unassigned.'))
      return;
    try {
      setSaving(true);
      await agentApi.deleteGroup(groupId);
      router.replace('/dashboard/groups');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to delete group.');
      setSaving(false);
    }
  };

  if (loading)
    return <div className="text-sm text-text-tertiary">Loading group...</div>;
  if (!group) return null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-sm bg-accent-danger/10 border border-accent-danger/20 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">
            {group.name}
          </h2>
          <p className="text-[13px] text-text-tertiary mt-1">
            Agents: {group.agent_count ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/rules?groupId=${groupId}`)}
            className="h-9 px-3 border border-border-primary text-[13px] rounded-sm hover:bg-bg-tertiary"
          >
            Open Rules
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/alerts?groupId=${groupId}`)}
            className="h-9 px-3 border border-border-primary text-[13px] rounded-sm hover:bg-bg-tertiary"
          >
            Open Alerts
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/groups')}
            className="h-9 px-3 border border-border-primary text-[13px] rounded-sm hover:bg-bg-tertiary"
          >
            Back to Groups
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 space-y-3">
        <h3 className="text-[14px] font-semibold text-text-primary">
          Group Settings
        </h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value as 'store' | 'region' | 'device_type' | 'customer',
            )
          }
          className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
        >
          <option value="store">Store</option>
          <option value="region">Region</option>
          <option value="device_type">Device Type</option>
          <option value="customer">Customer</option>
        </select>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full min-h-[90px] px-3 py-2 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveGroup}
            disabled={saving}
            className="h-9 px-4 bg-accent-primary text-white text-[13px] font-medium rounded-sm hover:bg-accent-primary-hover disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={deleteGroup}
            disabled={saving}
            className="h-9 px-4 border border-accent-danger/30 text-accent-danger text-[13px] font-medium rounded-sm hover:bg-accent-danger/10 disabled:opacity-50"
          >
            Delete Group
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary text-[14px] font-semibold text-text-primary">
          Agents in this Group
        </div>
        {agents.length === 0 ? (
          <div className="p-4 text-[13px] text-text-tertiary">
            No agents assigned to this group yet.
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => router.push(`/dashboard/agents/${a.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-bg-tertiary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text-primary truncate">
                      {a.name || a.thing_name}
                    </div>
                    <div className="text-[12px] text-text-tertiary truncate">
                      {a.thing_name}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                      a.status === 'online'
                        ? 'bg-accent-success/10 text-accent-success'
                        : a.status === 'revoked'
                          ? 'bg-accent-danger/10 text-accent-danger'
                          : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
