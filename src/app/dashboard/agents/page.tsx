'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agentApi, type Agent } from '@/lib/api';

export default function AgentsListPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAgents = useCallback(() => {
    setLoading(true);
    agentApi
      .list({ status: statusFilter || undefined, limit: 50 })
      .then((res) => {
        setAgents(res.agents);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="space-y-4">
      {/* Toolbar: stack on mobile, row on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-bg-secondary border border-border-primary rounded-sm overflow-hidden">
            {[
              { label: 'All', value: '' },
              { label: 'Online', value: 'online' },
              { label: 'Offline', value: 'offline' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                  statusFilter === opt.value
                    ? 'bg-accent-primary text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-text-tertiary">
            {total} agent{total !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={() => router.push('/dashboard/agents/register')}
          className="h-9 px-4 bg-accent-primary hover:bg-accent-primary-hover text-white text-[13px] font-medium rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:shrink-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Add Agent
        </button>
      </div>

      {/* Desktop: table | Mobile: card list */}
      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-tertiary text-sm">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-tertiary text-sm mb-3">
              {statusFilter
                ? 'No matching agents.'
                : 'No agents registered yet.'}
            </p>
            {!statusFilter && (
              <button
                onClick={() => router.push('/dashboard/agents/register')}
                className="text-[13px] text-accent-primary hover:text-accent-primary-hover font-medium cursor-pointer"
              >
                Register your first agent
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table: hidden on small, visible md+ */}
            <div className="hidden md:block overflow-x-auto">
              <div className="grid grid-cols-[auto_1fr_120px_100px_80px_140px] min-w-[640px] gap-4 px-4 sm:px-5 py-3 border-b border-border-primary bg-bg-tertiary/50 text-[12px] font-medium text-text-secondary uppercase tracking-wide">
                <div className="w-3" />
                <div>Name</div>
                <div>OS / Arch</div>
                <div>Version</div>
                <div>Status</div>
                <div>Last Seen</div>
              </div>
              <div className="divide-y divide-border-primary">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                    className="grid grid-cols-[auto_1fr_120px_100px_80px_140px] min-w-[640px] gap-4 px-4 sm:px-5 py-3 hover:bg-bg-tertiary/30 cursor-pointer transition-colors items-center"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        agent.status === 'online'
                          ? 'bg-accent-success'
                          : agent.status === 'revoked'
                            ? 'bg-accent-danger'
                            : 'bg-border-secondary'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-text-primary truncate">
                        {agent.name || agent.thing_name}
                      </div>
                      {agent.name && (
                        <div className="text-[11px] text-text-tertiary font-mono truncate">
                          {agent.thing_name}
                        </div>
                      )}
                    </div>
                    <div className="text-[13px] text-text-secondary">
                      {agent.os ? `${agent.os}/${agent.arch}` : '-'}
                    </div>
                    <div className="text-[13px] text-text-secondary font-mono">
                      {agent.version || '-'}
                    </div>
                    <div>
                      <span
                        className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          agent.status === 'online'
                            ? 'bg-accent-success/10 text-accent-success'
                            : agent.status === 'revoked'
                              ? 'bg-accent-danger/10 text-accent-danger'
                              : 'bg-bg-tertiary text-text-tertiary'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <div className="text-[12px] text-text-tertiary">
                      {agent.last_seen_at
                        ? formatTimeAgo(agent.last_seen_at)
                        : 'Never connected'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards: visible on small, hidden md+ */}
            <div className="md:hidden divide-y divide-border-primary">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-bg-tertiary/30 active:bg-bg-tertiary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                        agent.status === 'online'
                          ? 'bg-accent-success'
                          : agent.status === 'revoked'
                            ? 'bg-accent-danger'
                            : 'bg-border-secondary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text-primary truncate">
                        {agent.name || agent.thing_name}
                      </div>
                      {agent.name && (
                        <div className="text-[11px] text-text-tertiary font-mono truncate mt-0.5">
                          {agent.thing_name}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[12px] text-text-tertiary">
                        {agent.os && (
                          <span>
                            {agent.os}/{agent.arch}
                          </span>
                        )}
                        {agent.version && (
                          <span className="font-mono">v{agent.version}</span>
                        )}
                        <span
                          className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            agent.status === 'online'
                              ? 'bg-accent-success/10 text-accent-success'
                              : agent.status === 'revoked'
                                ? 'bg-accent-danger/10 text-accent-danger'
                                : 'bg-bg-tertiary text-text-tertiary'
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-1">
                        Last seen:{' '}
                        {agent.last_seen_at
                          ? formatTimeAgo(agent.last_seen_at)
                          : 'Never'}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-text-tertiary shrink-0 mt-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
