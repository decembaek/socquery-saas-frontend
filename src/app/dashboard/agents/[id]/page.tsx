'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  agentApi,
  type Agent,
  type AgentEvent,
  type AgentCommand,
  type AgentGroup,
} from '@/lib/api';

type Tab = 'events' | 'commands';
type EventFilter =
  | 'all'
  | 'status'
  | 'telemetry'
  | 'scan'
  | 'anomaly'
  | 'response';

// ─── Extracted data types ───

interface SystemMetrics {
  cpu?: { usagePercent?: number; cores?: number };
  memory?: {
    usagePercent?: number;
    totalGB?: number;
    freeGB?: number;
    usedGB?: number;
  };
  disk?: { usagePercent?: number; totalGB?: number; freeGB?: number };
}

interface USBDevice {
  vendor?: string;
  product?: string;
  vendorId?: string;
  productId?: string;
  serial?: string;
}

interface AnomalyEntry {
  severity: string;
  message: string;
  category: string;
  type: string;
  timestamp: number;
  details: Record<string, unknown>;
}

interface ProcessEntry {
  name: string;
  cpu?: number;
  mem?: number;
  pid?: number;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('events');
  const [commandAction, setCommandAction] = useState('ping');
  const [sendingCommand, setSendingCommand] = useState(false);
  const [updatingGroup, setUpdatingGroup] = useState(false);

  const fetchAll = useCallback(() => {
    Promise.all([
      agentApi.get(agentId),
      agentApi.getEvents(agentId, { limit: 50 }),
      agentApi.getCommands(agentId, { limit: 20 }),
      agentApi.listGroups(),
    ])
      .then(([agentRes, eventsRes, commandsRes, groupsRes]) => {
        setAgent(agentRes.agent);
        setEvents(eventsRes.events);
        setCommands(commandsRes.commands);
        setGroups(groupsRes.groups);
      })
      .catch(() => router.replace('/dashboard/agents'))
      .finally(() => setLoading(false));
  }, [agentId, router]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ─── Derive latest snapshot from events ───

  const latestMetrics = useMemo<SystemMetrics | null>(() => {
    const ev = events.find((e) => e.type === 'telemetry');
    if (!ev) return null;
    const d = ev.data as Record<string, unknown>;
    return {
      cpu: d.cpu as SystemMetrics['cpu'],
      memory: d.memory as SystemMetrics['memory'],
      disk: d.disk as SystemMetrics['disk'],
    };
  }, [events]);

  const latestUSB = useMemo<USBDevice[]>(() => {
    for (const ev of events) {
      const d = ev.data as Record<string, unknown>;
      if (d.devices && Array.isArray(d.devices)) {
        return d.devices as USBDevice[];
      }
    }
    return [];
  }, [events]);

  const recentAnomalies = useMemo<AnomalyEntry[]>(() => {
    return events
      .filter((e) => e.type === 'anomaly')
      .slice(0, 5)
      .map((e) => {
        const d = e.data as Record<string, unknown>;
        const details =
          d.details &&
          typeof d.details === 'object' &&
          !Array.isArray(d.details)
            ? (d.details as Record<string, unknown>)
            : {};
        return {
          severity: String(d.severity || 'warning'),
          message: String(d.message || 'Anomaly detected'),
          category: String(d.category || ''),
          type: String(d.type || ''),
          timestamp: e.created_at,
          details,
        };
      });
  }, [events]);

  const latestProcesses = useMemo<ProcessEntry[]>(() => {
    const procItem = (p: {
      name?: string;
      cpu?: number;
      mem?: number;
      pid?: number;
    }) => ({
      name: String(p.name || 'unknown'),
      cpu: p.cpu,
      mem: p.mem,
      pid: p.pid,
    });
    for (const ev of events) {
      const d = ev.data as Record<string, unknown>;
      let topCpu = d.topCpu as
        | Array<{ name?: string; cpu?: number; mem?: number; pid?: number }>
        | undefined;
      let topMem = d.topMem as
        | Array<{ name?: string; cpu?: number; mem?: number; pid?: number }>
        | undefined;
      const processBlock = d.process as Record<string, unknown> | undefined;
      if (processBlock?.topCpu || processBlock?.topMem) {
        topCpu = processBlock.topCpu as typeof topCpu;
        topMem = processBlock.topMem as typeof topMem;
      }
      if (topCpu?.length || topMem?.length) {
        const byName = new Map<string, ProcessEntry>();
        for (const p of topCpu ?? []) {
          const e = procItem(p);
          byName.set(e.name, e);
        }
        for (const p of topMem ?? []) {
          const e = procItem(p);
          const existing = byName.get(e.name);
          byName.set(e.name, {
            name: e.name,
            cpu: existing?.cpu ?? e.cpu,
            mem: existing?.mem ?? e.mem,
            pid: existing?.pid ?? e.pid,
          });
        }
        return Array.from(byName.values())
          .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0))
          .slice(0, 15);
      }
    }
    return [];
  }, [events]);

  // ─── Handlers ───

  const handleSendCommand = async () => {
    if (!agent) return;
    setSendingCommand(true);
    try {
      await agentApi.sendCommand(agent.id, commandAction);
      setTimeout(fetchAll, 1000);
    } catch {
      /* ignore */
    }
    setSendingCommand(false);
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (
      !confirm(
        `Delete "${agent.display_name || agent.name || agent.thing_name}"?\nAWS IoT certificates will also be revoked.`,
      )
    )
      return;
    try {
      await agentApi.delete(agent.id);
      router.replace('/dashboard/agents');
    } catch {
      /* ignore */
    }
  };

  const handleGroupChange = async (nextGroupId: string) => {
    if (!agent) return;
    try {
      setUpdatingGroup(true);
      await agentApi.update(agent.id, { group_id: nextGroupId || null });
      setAgent({ ...agent, group_id: nextGroupId || null });
    } catch {
      /* ignore */
    } finally {
      setUpdatingGroup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-tertiary text-sm">
        Loading agent...
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard/agents')}
            className="p-1.5 rounded-sm hover:bg-bg-tertiary transition-colors cursor-pointer text-text-secondary shrink-0"
            aria-label="Back to agents"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-semibold text-text-primary truncate">
                {agent.display_name || agent.name || agent.thing_name}
              </h2>
              <span
                className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
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
            <p className="text-[12px] text-text-tertiary font-mono mt-0.5 truncate">
              {agent.thing_name}
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="h-8 px-3 text-[12px] font-medium text-accent-danger border border-accent-danger/30 rounded-sm hover:bg-accent-danger/10 transition-colors cursor-pointer w-full sm:w-auto shrink-0"
        >
          Delete Agent
        </button>
      </div>

      {/* ── Overview: Row 1 = CPU/Memory/Disk, Row 2 = OS/Version/Last Seen/Registered ── */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {latestMetrics?.cpu != null ? (
            <MetricCard
              label="CPU"
              value={latestMetrics.cpu.usagePercent ?? 0}
              unit="%"
              sub={
                latestMetrics.cpu.cores
                  ? `${latestMetrics.cpu.cores} cores`
                  : undefined
              }
            />
          ) : (
            <InfoCard label="CPU" value="-" />
          )}
          {latestMetrics?.memory != null ? (
            <MetricCard
              label="Memory"
              value={latestMetrics.memory.usagePercent ?? 0}
              unit="%"
              sub={
                latestMetrics.memory.totalGB
                  ? `${latestMetrics.memory.freeGB?.toFixed(1) ?? '?'} / ${latestMetrics.memory.totalGB.toFixed(1)} GB free`
                  : undefined
              }
            />
          ) : (
            <InfoCard label="Memory" value="-" />
          )}
          {latestMetrics?.disk != null ? (
            <MetricCard
              label="Disk"
              value={latestMetrics.disk.usagePercent ?? 0}
              unit="%"
              sub={
                latestMetrics.disk.totalGB
                  ? `${latestMetrics.disk.freeGB?.toFixed(1) ?? '?'} / ${latestMetrics.disk.totalGB.toFixed(1)} GB free`
                  : undefined
              }
            />
          ) : (
            <InfoCard label="Disk" value="-" />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard
            label="OS / Arch"
            value={agent.os ? `${agent.os} / ${agent.arch}` : '-'}
          />
          <InfoCard label="Version" value={agent.version || '-'} mono />
          <InfoCard
            label="Last Seen"
            value={
              agent.last_seen_at ? formatRelative(agent.last_seen_at) : 'Never'
            }
          />
          <InfoCard label="Registered" value={formatTime(agent.created_at)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[13px] font-semibold text-text-primary">
              USB Devices
              {latestUSB.length > 0 && (
                <span className="ml-2 text-[11px] font-normal text-text-tertiary">
                  {latestUSB.length} connected
                </span>
              )}
            </div>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-border-primary">
              {latestUSB.length === 0 ? (
                <div className="p-4 text-[13px] text-text-tertiary text-center">
                  No USB devices detected.
                </div>
              ) : (
                latestUSB.map((dev, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-7 h-7 rounded bg-bg-tertiary flex items-center justify-center shrink-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-text-tertiary"
                      >
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18.01" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-text-primary truncate">
                        {dev.vendor || 'Unknown'} {dev.product || ''}
                      </div>
                      <div className="text-[10px] text-text-tertiary font-mono">
                        {dev.vendorId || '????'}:{dev.productId || '????'}
                        {dev.serial ? ` / ${dev.serial}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[13px] font-semibold text-text-primary">
              Process list
              {latestProcesses.length > 0 && (
                <span className="ml-2 text-[11px] font-normal text-text-tertiary">
                  top {latestProcesses.length} by CPU
                </span>
              )}
            </div>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-border-primary">
              {latestProcesses.length === 0 ? (
                <div className="p-4 text-[13px] text-text-tertiary text-center">
                  No process data yet. Run scan_process or scan_all.
                </div>
              ) : (
                latestProcesses.map((proc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-text-primary truncate">
                        {proc.name}
                      </div>
                      {proc.pid != null && (
                        <div className="text-[10px] text-text-tertiary font-mono">
                          PID {proc.pid}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 shrink-0 text-[11px]">
                      {proc.cpu != null && (
                        <span className="text-text-secondary">
                          CPU {proc.cpu.toFixed(1)}%
                        </span>
                      )}
                      {proc.mem != null && (
                        <span className="text-text-tertiary">
                          Mem {proc.mem.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {recentAnomalies.length > 0 && (
          <section className="bg-bg-secondary rounded-md border border-border-primary shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary text-[13px] font-semibold text-text-primary">
              Recent anomalies
            </div>
            <div className="divide-y divide-border-primary">
              {recentAnomalies.slice(0, 3).map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-[12px] text-text-primary flex-1 truncate">
                    {a.message}
                  </span>
                  <span className="text-[10px] text-text-tertiary shrink-0">
                    {formatRelative(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Group Assignment ── */}
      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">
          Group Assignment
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={agent.group_id || ''}
            onChange={(e) => handleGroupChange(e.target.value)}
            disabled={updatingGroup}
            className="h-9 px-3 text-[13px] bg-bg-primary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors cursor-pointer w-full sm:w-auto min-w-[220px]"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => router.push('/dashboard/groups')}
            className="h-9 px-3 text-[13px] text-text-secondary border border-border-primary rounded-sm hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            Manage Groups
          </button>
          {updatingGroup && (
            <span className="text-[12px] text-text-tertiary">Updating...</span>
          )}
        </div>
      </div>

      {/* ── Command Panel ── */}
      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">
          Send Command
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <select
            value={commandAction}
            onChange={(e) => setCommandAction(e.target.value)}
            className="h-9 px-3 text-[13px] bg-bg-primary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors cursor-pointer w-full sm:w-auto min-w-0"
          >
            <option value="ping">ping</option>
            <option value="scan_health">scan_health</option>
            <option value="scan_usb">scan_usb</option>
            <option value="scan_process">scan_process</option>
            <option value="scan_network">scan_network</option>
            <option value="scan_all">scan_all</option>
          </select>
          <div className="flex gap-2 sm:shrink-0">
            <button
              onClick={handleSendCommand}
              disabled={sendingCommand}
              className="h-9 flex-1 sm:flex-none px-4 bg-accent-primary hover:bg-accent-primary-hover text-white text-[13px] font-medium rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {sendingCommand ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={fetchAll}
              className="h-9 px-3 text-[13px] text-text-secondary border border-border-primary rounded-sm hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs: Events / Commands ── */}
      <div className="min-w-0">
        <div className="flex items-center gap-0 border-b border-border-primary overflow-x-auto">
          {[
            { key: 'events' as const, label: `Events (${events.length})` },
            {
              key: 'commands' as const,
              label: `Commands (${commands.length})`,
            },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
                tab === t.key
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'events' && <EventsList events={events} />}
          {tab === 'commands' && <CommandsList commands={commands} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub Components
// ═══════════════════════════════════════════════════════════════════

function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-bg-secondary rounded-md border border-border-primary p-4 shadow-sm">
      <div className="text-[12px] text-text-tertiary mb-1">{label}</div>
      <div
        className={`text-[14px] font-medium text-text-primary ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: number;
  unit: string;
  sub?: string;
}) {
  const color =
    value >= 90
      ? 'text-accent-danger'
      : value >= 70
        ? 'text-accent-warning'
        : 'text-accent-success';
  const barColor =
    value >= 90
      ? 'bg-accent-danger'
      : value >= 70
        ? 'bg-accent-warning'
        : 'bg-accent-success';

  return (
    <div className="bg-bg-secondary rounded-md border border-border-primary p-4 shadow-sm">
      <div className="text-[12px] text-text-tertiary mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-[22px] font-bold ${color}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-[12px] text-text-tertiary">{unit}</span>
      </div>
      <div className="mt-2 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {sub && (
        <div className="text-[11px] text-text-tertiary mt-1.5">{sub}</div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, string> = {
    critical: 'bg-accent-danger/10 text-accent-danger',
    warning: 'bg-accent-warning/10 text-accent-warning',
    info: 'bg-accent-info/10 text-accent-info',
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${config[severity] || config.warning}`}
    >
      {severity}
    </span>
  );
}

// ─── Events Tab ───

function EventsList({ events }: { events: AgentEvent[] }) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const eventsWithoutScan = useMemo(
    () => events.filter((e) => e.type !== 'scan'),
    [events],
  );

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? eventsWithoutScan
        : eventsWithoutScan.filter((e) => e.type === filter),
    [eventsWithoutScan, filter],
  );

  const grouped = useMemo(() => {
    const now = new Date();
    const todayStart =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() /
      1000;
    const yesterdayStart = todayStart - 86400;

    const groups: { label: string; events: AgentEvent[] }[] = [
      { label: 'Today', events: [] },
      { label: 'Yesterday', events: [] },
      { label: 'Earlier', events: [] },
    ];

    for (const ev of filtered) {
      if (ev.created_at >= todayStart) groups[0].events.push(ev);
      else if (ev.created_at >= yesterdayStart) groups[1].events.push(ev);
      else groups[2].events.push(ev);
    }

    return groups.filter((g) => g.events.length > 0);
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: eventsWithoutScan.length };
    for (const e of eventsWithoutScan) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [eventsWithoutScan]);

  const filterButtons: { key: EventFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'status', label: 'Status' },
    { key: 'telemetry', label: 'Telemetry' },
    { key: 'anomaly', label: 'Anomaly' },
    { key: 'response', label: 'Response' },
  ];

  if (eventsWithoutScan.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No events yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((fb) => {
          const count = counts[fb.key] || 0;
          if (fb.key !== 'all' && count === 0) return null;
          return (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-full border transition-colors cursor-pointer ${
                filter === fb.key
                  ? 'bg-accent-primary/10 text-accent-primary border-accent-primary/30'
                  : 'bg-bg-secondary text-text-secondary border-border-primary hover:bg-bg-tertiary'
              }`}
            >
              {fb.label}
              <span className="text-[11px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grouped Events */}
      {grouped.length === 0 ? (
        <div className="text-center py-8 text-text-tertiary text-sm">
          No events in this category.
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wider">
                {group.label}
              </div>
              <div className="flex-1 h-px bg-border-primary" />
              <span className="text-[11px] text-text-tertiary">
                {group.events.length}
              </span>
            </div>
            <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm divide-y divide-border-primary">
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const badgeConfig: Record<string, string> = {
    status: 'bg-accent-info/10 text-accent-info',
    telemetry: 'bg-accent-success/10 text-accent-success',
    scan: 'bg-accent-secondary/10 text-accent-secondary',
    anomaly: 'bg-accent-warning/10 text-accent-warning',
    response: 'bg-[#8b5cf6]/10 text-[#8b5cf6]',
  };

  return (
    <details className="group">
      <summary className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-bg-tertiary/30 cursor-pointer transition-colors list-none">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-tertiary shrink-0 transition-transform group-open:rotate-90"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeConfig[event.type] || 'bg-bg-tertiary text-text-tertiary'}`}
        >
          {event.type}
        </span>
        <span className="text-[13px] text-text-primary flex-1 truncate">
          {getEventSummary(event)}
        </span>
        <span className="text-[12px] text-text-tertiary shrink-0">
          {formatRelative(event.created_at)}
        </span>
      </summary>
      <div className="px-5 pb-4 pt-1">
        <EventDetail event={event} />
      </div>
    </details>
  );
}

function EventDetail({ event }: { event: AgentEvent }) {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data)
    return <div className="text-[12px] text-text-tertiary py-2">No data</div>;

  switch (event.type) {
    case 'status':
      return <StatusDetail data={data} />;
    case 'telemetry':
      return <TelemetryDetail data={data} />;
    case 'anomaly':
      return <AnomalyDetail data={data} />;
    case 'response':
      return <ResponseDetail data={data} />;
    default:
      return <RawDetail data={data} />;
  }
}

function StatusDetail({ data }: { data: Record<string, unknown> }) {
  const status = String(data.status || 'unknown');
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${status === 'online' ? 'bg-accent-success' : 'bg-text-tertiary'}`}
      />
      <div>
        <div className="text-[13px] font-medium text-text-primary">
          Agent {status}
        </div>
        <div className="text-[12px] text-text-tertiary mt-0.5 space-x-3">
          {data.os ? <span>OS: {String(data.os)}</span> : null}
          {data.arch ? <span>Arch: {String(data.arch)}</span> : null}
          {data.version ? <span>v{String(data.version)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function TelemetryDetail({ data }: { data: Record<string, unknown> }) {
  const cpu = data.cpu as SystemMetrics['cpu'];
  const memory = data.memory as SystemMetrics['memory'];
  const disk = data.disk as SystemMetrics['disk'];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
      {cpu && (
        <MiniMetric
          label="CPU"
          value={cpu.usagePercent ?? 0}
          sub={cpu.cores ? `${cpu.cores} cores` : undefined}
        />
      )}
      {memory && (
        <MiniMetric
          label="Memory"
          value={memory.usagePercent ?? 0}
          sub={
            memory.totalGB
              ? `${memory.freeGB?.toFixed(1) ?? '?'} / ${memory.totalGB.toFixed(1)} GB free`
              : undefined
          }
        />
      )}
      {disk && (
        <MiniMetric
          label="Disk"
          value={disk.usagePercent ?? 0}
          sub={
            disk.totalGB
              ? `${disk.freeGB?.toFixed(1) ?? '?'} / ${disk.totalGB.toFixed(1)} GB free`
              : undefined
          }
        />
      )}
      {!cpu && !memory && !disk && <RawDetail data={data} />}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  const color =
    value >= 90
      ? 'text-accent-danger'
      : value >= 70
        ? 'text-accent-warning'
        : 'text-accent-success';
  return (
    <div className="bg-bg-primary rounded border border-border-primary p-3">
      <div className="text-[11px] text-text-tertiary">{label}</div>
      <div className={`text-[16px] font-bold ${color}`}>
        {value.toFixed(1)}%
      </div>
      {sub && (
        <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function AnomalyDetail({ data }: { data: Record<string, unknown> }) {
  const severity = String(data.severity || 'warning');
  const message = String(data.message || 'Anomaly detected');
  const category = String(data.category || '');
  const type = String(data.type || '');
  const details =
    data.details &&
    typeof data.details === 'object' &&
    !Array.isArray(data.details)
      ? (data.details as Record<string, unknown>)
      : {};

  const borderColor: Record<string, string> = {
    critical: 'border-accent-danger/40',
    warning: 'border-accent-warning/40',
    info: 'border-accent-info/40',
  };

  return (
    <div
      className={`rounded border ${borderColor[severity] || borderColor.warning} p-3 space-y-2`}
    >
      <div className="flex items-center gap-2">
        <SeverityBadge severity={severity} />
        <span className="text-[13px] font-medium text-text-primary">
          {message}
        </span>
      </div>
      <div className="text-[11px] text-text-tertiary space-x-2">
        {category && <span>Category: {category}</span>}
        {type && <span className="font-mono">Type: {type}</span>}
      </div>
      {Object.keys(details).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(details).map(([key, val]) => {
            if (val === null || val === undefined || val === '') return null;
            const display =
              typeof val === 'number'
                ? Number.isInteger(val)
                  ? String(val)
                  : (val as number).toFixed(1)
                : typeof val === 'boolean'
                  ? val
                    ? 'yes'
                    : 'no'
                  : String(val);
            return (
              <span key={key} className="text-[11px] text-text-tertiary">
                <span className="text-text-secondary">{key}:</span> {display}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResponseDetail({ data }: { data: Record<string, unknown> }) {
  const commandId = typeof data.commandId === 'string' ? data.commandId : '';
  const exitCode = typeof data.exitCode === 'number' ? data.exitCode : null;
  const isSuccess = exitCode === 0;
  const error = data.error ? String(data.error) : null;
  const result = data.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isSuccess ? 'bg-accent-success' : 'bg-accent-danger'}`}
        />
        <span className="text-[13px] font-medium text-text-primary">
          {isSuccess ? 'Command succeeded' : 'Command failed'}
        </span>
        <span className="text-[11px] text-text-tertiary font-mono">
          {commandId.slice(0, 12)} / exit {exitCode ?? '?'}
        </span>
      </div>
      {error && (
        <div className="text-[12px] text-accent-danger bg-accent-danger/5 border border-accent-danger/20 rounded p-3">
          {error}
        </div>
      )}
      {result && Object.keys(result).length > 0 && (
        <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-3 text-[12px] font-mono overflow-x-auto max-h-[200px] overflow-y-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function RawDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 text-[12px] font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Commands Tab ───

function CommandsList({ commands }: { commands: AgentCommand[] }) {
  if (commands.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No commands sent yet.
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-accent-warning/10 text-accent-warning',
    delivered: 'bg-accent-info/10 text-accent-info',
    completed: 'bg-accent-success/10 text-accent-success',
    failed: 'bg-accent-danger/10 text-accent-danger',
    timeout: 'bg-bg-tertiary text-text-tertiary',
  };

  return (
    <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm divide-y divide-border-primary">
      {commands.map((cmd) => (
        <details key={cmd.id} className="group">
          <summary className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-bg-tertiary/30 cursor-pointer transition-colors list-none">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-tertiary shrink-0 transition-transform group-open:rotate-90"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <code className="text-[12px] font-mono text-text-primary shrink-0">
              {cmd.action}
            </code>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColors[cmd.status] || 'bg-bg-tertiary text-text-tertiary'}`}
            >
              {cmd.status}
            </span>
            {cmd.exit_code !== null && cmd.exit_code !== undefined && (
              <span className="text-[11px] text-text-tertiary">
                exit: {cmd.exit_code}
              </span>
            )}
            <span className="flex-1" />
            <span className="text-[12px] text-text-tertiary shrink-0">
              {formatTime(cmd.created_at)}
            </span>
          </summary>
          <div className="px-5 pb-4 pt-1 space-y-2">
            {cmd.params && Object.keys(cmd.params).length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary mb-1">
                  Params
                </div>
                <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-3 text-[12px] font-mono overflow-x-auto">
                  {JSON.stringify(cmd.params, null, 2)}
                </pre>
              </div>
            )}
            {cmd.result != null ? (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary mb-1">
                  Result
                </div>
                <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-3 text-[12px] font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                  {JSON.stringify(cmd.result, null, 2)}
                </pre>
              </div>
            ) : null}
            {cmd.error && (
              <div>
                <div className="text-[11px] font-medium text-accent-danger mb-1">
                  Error
                </div>
                <div className="text-[13px] text-accent-danger bg-accent-danger/5 p-3 rounded-sm">
                  {typeof cmd.error === 'string'
                    ? cmd.error
                    : String(cmd.error ?? '')}
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function getEventSummary(event: AgentEvent): string {
  const data = event.data as Record<string, unknown> | undefined;
  const cpu = data?.cpu as { usagePercent?: number } | undefined;
  const memory = data?.memory as { usagePercent?: number } | undefined;
  const disk = data?.disk as { usagePercent?: number } | undefined;
  const commandId =
    typeof data?.commandId === 'string' ? data.commandId.slice(0, 8) : '';

  switch (event.type) {
    case 'status':
      return `Agent ${String(data?.status || 'unknown')}`;
    case 'telemetry': {
      const parts: string[] = [];
      if (cpu?.usagePercent !== undefined)
        parts.push(`CPU ${cpu.usagePercent.toFixed(1)}%`);
      if (memory?.usagePercent !== undefined)
        parts.push(`Mem ${memory.usagePercent.toFixed(1)}%`);
      if (disk?.usagePercent !== undefined)
        parts.push(`Disk ${disk.usagePercent.toFixed(1)}%`);
      return parts.length > 0 ? parts.join(' / ') : 'System metrics';
    }
    case 'scan': {
      const action = String(data?.action || '');
      const devices = data?.devices as unknown[] | undefined;
      if (action === 'usb' || (devices && Array.isArray(devices)))
        return `USB scan (${Array.isArray(devices) ? devices.length : 0} devices)`;
      if (action === 'health') return 'Health scan completed';
      if (action === 'process') return 'Process scan completed';
      if (action === 'network') return 'Network scan completed';
      return 'Scan result';
    }
    case 'anomaly': {
      const severity = String(data?.severity || 'warning').toUpperCase();
      const message = String(data?.message || 'Anomaly detected');
      return `[${severity}] ${message}`;
    }
    case 'response': {
      const exitCode = data?.exitCode;
      return `Command ${commandId} exit ${exitCode ?? '?'}`;
    }
    default:
      return event.type;
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(timestamp: number): string {
  const diffMs = Date.now() - timestamp * 1000;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  if (diffMin < 2880) return 'yesterday';

  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
