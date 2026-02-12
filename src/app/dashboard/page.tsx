"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { agentApi, type Agent } from "@/lib/api";

export default function DashboardOverview() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentApi
      .list({ limit: 100 })
      .then((res) => setAgents(res.agents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const online = agents.filter((a) => a.status === "online").length;
  const offline = agents.filter((a) => a.status === "offline").length;
  const total = agents.length;

  const stats = [
    { label: "Total Agents", value: total, color: "text-accent-info" },
    { label: "Online", value: online, color: "text-accent-success" },
    { label: "Offline", value: offline, color: "text-text-tertiary" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-secondary rounded-[var(--radius-md)] border border-border-primary p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="text-[13px] text-text-secondary mb-1">{stat.label}</div>
            <div className={`text-3xl font-bold ${stat.color}`}>
              {loading ? "-" : stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent agents */}
      <div className="bg-bg-secondary rounded-[var(--radius-md)] border border-border-primary shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <h2 className="text-[14px] font-semibold text-text-primary">Recent Agents</h2>
          <button
            onClick={() => router.push("/dashboard/agents")}
            className="text-[13px] text-accent-primary hover:text-accent-primary-hover font-medium cursor-pointer"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-border-primary">
          {loading ? (
            <div className="p-8 text-center text-text-tertiary text-sm">Loading...</div>
          ) : agents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-tertiary text-sm mb-3">No agents registered yet.</p>
              <button
                onClick={() => router.push("/dashboard/agents/register")}
                className="text-[13px] text-accent-primary hover:text-accent-primary-hover font-medium cursor-pointer"
              >
                Register your first agent
              </button>
            </div>
          ) : (
            agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-bg-tertiary/50 cursor-pointer transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    agent.status === "online"
                      ? "bg-accent-success"
                      : agent.status === "revoked"
                        ? "bg-accent-danger"
                        : "bg-text-tertiary"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text-primary truncate">
                    {agent.name || agent.thing_name}
                  </div>
                  <div className="text-[12px] text-text-tertiary">
                    {agent.os && `${agent.os}/${agent.arch}`}
                    {agent.version && ` v${agent.version}`}
                  </div>
                </div>
                <div className="text-[12px] text-text-tertiary shrink-0">
                  {agent.last_seen_at
                    ? formatTimeAgo(agent.last_seen_at)
                    : "Never"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
