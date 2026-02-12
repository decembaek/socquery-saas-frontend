'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, agentApi, type AgentGroup } from '@/lib/api';

const GROUP_CATEGORY_OPTIONS = [
  { value: 'store', label: '매장 (Store)' },
  { value: 'region', label: '지역 (Region)' },
  { value: 'device_type', label: '기기 타입 (Device Type)' },
  { value: 'customer', label: '고객사 (Customer)' },
] as const;

const GROUP_CATEGORY_LABEL: Record<string, string> = {
  store: 'Store',
  region: 'Region',
  device_type: 'Device Type',
  customer: 'Customer',
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<
    'store' | 'region' | 'device_type' | 'customer'
  >('store');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const fetchGroups = useCallback(async () => {
    const res = await agentApi.listGroups();
    setGroups(res.groups);
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

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      setSaving(true);
      await agentApi.createGroup({
        name: newGroupName.trim(),
        category: newGroupCategory,
        description: newGroupDescription.trim(),
      });
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupCategory('store');
      await fetchGroups();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to create group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4">
        <h2 className="text-[16px] font-semibold text-text-primary">Operational Groups</h2>
        <p className="text-[13px] text-text-secondary mt-1">
          Groups are physical/operational units (Store, Region, Device Type, Customer), not technical clusters.
        </p>
      </div> */}

      {error && (
        <div className="p-3 rounded-sm bg-accent-danger/10 border border-accent-danger/20 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreateGroup}
        className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 space-y-3"
      >
        <h3 className="text-[14px] font-semibold text-text-primary">
          Create Group
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
          />
          <select
            value={newGroupCategory}
            onChange={(e) =>
              setNewGroupCategory(
                e.target.value as
                  | 'store'
                  | 'region'
                  | 'device_type'
                  | 'customer',
              )
            }
            className="h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
          >
            {GROUP_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-4 bg-accent-primary text-white text-[13px] font-medium rounded-sm hover:bg-accent-primary-hover disabled:opacity-50"
          >
            Add Group
          </button>
        </div>
        <textarea
          value={newGroupDescription}
          onChange={(e) => setNewGroupDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full min-h-[80px] px-3 py-2 text-[14px] bg-bg-primary border border-border-primary rounded-sm"
        />
      </form>

      {loading ? (
        <div className="text-sm text-text-tertiary">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-6 text-[13px] text-text-tertiary">
          No groups yet. Create your first operational group.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/groups/${g.id}`}
              className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 hover:bg-bg-tertiary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-text-primary truncate">
                  {g.name}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary shrink-0">
                  {GROUP_CATEGORY_LABEL[g.category] || g.category}
                </span>
              </div>
              <p className="text-[12px] text-text-tertiary mt-1 line-clamp-2 min-h-[32px]">
                {g.description || 'No description'}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[12px]">
                <span className="px-2 py-0.5 rounded-sm bg-accent-info/10 text-accent-info">
                  Agents {g.agent_count ?? 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
