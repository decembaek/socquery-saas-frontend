'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  authApi,
  getAccessToken,
  clearTokens,
  setAccessToken,
} from '@/lib/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

const OVERVIEW_ITEM = {
  label: 'Overview',
  href: '/dashboard',
  icon: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
};

const AGENTS_GROUP = {
  label: 'Agents',
  href: '/dashboard/agents',
  icon: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h.01" />
      <path d="M10 12h.01" />
      <path d="M14 12h4" />
    </svg>
  ),
  children: [
    { label: 'List', href: '/dashboard/agents' },
    { label: 'Register Agent', href: '/dashboard/agents/register' },
  ],
};

const GROUPS_ITEM = {
  label: 'Groups',
  href: '/dashboard/groups',
  icon: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20c0-2.8 2.2-5 5-5" />
      <path d="M13 20c0-2.8 2.2-5 5-5" />
    </svg>
  ),
};

const RULES_ITEM = {
  label: 'Rules',
  href: '/dashboard/rules',
  icon: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h7" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  ),
};

const ALERTS_ITEM = {
  label: 'Alerts',
  href: '/dashboard/alerts',
  icon: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22z" />
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2z" />
    </svg>
  ),
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadUserAndAccounts = () => {
    return authApi.me().then((res) => {
      setUser(res.user);
      setCurrentAccountId(res.current_account_id);
      return authApi.listAccounts().then((r) => setAccounts(r.accounts));
    });
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    loadUserAndAccounts()
      .catch(() => {
        clearTokens();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === currentAccountId) return;
    try {
      const res = await authApi.switchAccount(accountId);
      setAccessToken(res.access_token);
      const meRes = await authApi.me();
      setUser(meRes.user);
      setCurrentAccountId(meRes.current_account_id);
      router.refresh();
    } catch {
      // keep current selection on error
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      clearTokens();
    }
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  const pageTitle =
    pathname === '/dashboard'
      ? 'Overview'
      : pathname.startsWith('/dashboard/groups')
        ? 'Groups'
        : pathname.startsWith('/dashboard/rules')
          ? 'Rules'
          : pathname.startsWith('/dashboard/alerts')
            ? 'Alerts'
            : pathname === '/dashboard/agents/register'
              ? 'Register Agent'
              : pathname.startsWith('/dashboard/agents')
                ? 'Agents'
                : 'Dashboard';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 lg:px-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-primary rounded-sm flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-text-inverse">
            SocQuery
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 rounded-sm text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-inverse transition-colors"
          aria-label="Close menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Team selector */}
      {accounts.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b border-white/10">
          <label className="block text-[11px] font-medium text-text-sidebar uppercase tracking-wider mb-1.5">
            Team
          </label>
          <select
            value={currentAccountId ?? ''}
            onChange={(e) => handleSwitchAccount(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-[13px] font-medium bg-bg-sidebar-hover text-text-inverse border border-white/10 focus:outline-none focus:ring-1 focus:ring-accent-primary cursor-pointer"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        <Link
          href={OVERVIEW_ITEM.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
            pathname === '/dashboard'
              ? 'bg-bg-sidebar-active text-text-sidebar-active'
              : 'text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-sidebar-active'
          }`}
        >
          {OVERVIEW_ITEM.icon}
          {OVERVIEW_ITEM.label}
        </Link>
        <Link
          href={GROUPS_ITEM.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
            pathname.startsWith('/dashboard/groups')
              ? 'bg-bg-sidebar-active text-text-sidebar-active'
              : 'text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-sidebar-active'
          }`}
        >
          {GROUPS_ITEM.icon}
          {GROUPS_ITEM.label}
        </Link>
        <Link
          href={RULES_ITEM.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
            pathname.startsWith('/dashboard/rules')
              ? 'bg-bg-sidebar-active text-text-sidebar-active'
              : 'text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-sidebar-active'
          }`}
        >
          {RULES_ITEM.icon}
          {RULES_ITEM.label}
        </Link>
        <Link
          href={ALERTS_ITEM.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
            pathname.startsWith('/dashboard/alerts')
              ? 'bg-bg-sidebar-active text-text-sidebar-active'
              : 'text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-sidebar-active'
          }`}
        >
          {ALERTS_ITEM.icon}
          {ALERTS_ITEM.label}
        </Link>
        <div className="mt-1">
          <Link
            href={AGENTS_GROUP.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] font-medium transition-colors ${
              pathname.startsWith('/dashboard/agents')
                ? 'bg-bg-sidebar-active text-text-sidebar-active'
                : 'text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-sidebar-active'
            }`}
          >
            {AGENTS_GROUP.icon}
            {AGENTS_GROUP.label}
          </Link>
          <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
            {AGENTS_GROUP.children.map((child) => {
              const isChildActive =
                child.href === '/dashboard/agents'
                  ? pathname === '/dashboard/agents'
                  : pathname.startsWith(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`block py-1.5 rounded-sm text-[12px] font-medium transition-colors ${
                    isChildActive
                      ? 'text-text-sidebar-active'
                      : 'text-text-sidebar hover:text-text-sidebar-active'
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-xs font-bold text-accent-primary shrink-0">
            {user?.name?.[0]?.toUpperCase() ||
              user?.email?.[0]?.toUpperCase() ||
              'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text-inverse truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-[11px] text-text-sidebar truncate">
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-sm text-[13px] text-text-sidebar hover:bg-bg-sidebar-hover hover:text-accent-danger transition-colors cursor-pointer"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen bg-bg-primary flex overflow-hidden">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar: drawer on mobile, static on lg+ */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] max-w-[85vw] bg-bg-sidebar flex flex-col transform transition-transform duration-200 ease-out lg:relative lg:z-0 lg:w-[240px] lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col min-h-0">
        <header className="h-14 bg-bg-secondary border-b border-border-primary flex items-center gap-3 px-4 sm:px-6 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-text-primary truncate">
            {pageTitle}
          </h1>
        </header>

        <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
