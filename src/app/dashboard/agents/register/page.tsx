'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { agentApi, ApiError, type AgentGroup } from '@/lib/api';

const AGENT_RELEASE_BASE =
  process.env.NEXT_PUBLIC_AGENT_RELEASE_URL ||
  'https://download.socquery.com/releases/latest';

const OS_OPTIONS = [
  { id: 'linux', label: 'Linux (x64)', asset: 'soc-linux', isWindows: false },
  {
    id: 'darwin-arm64',
    label: 'macOS (Apple Silicon)',
    asset: 'soc-darwin-arm64',
    isWindows: false,
  },
  {
    id: 'darwin-amd64',
    label: 'macOS (Intel)',
    asset: 'soc-darwin-amd64',
    isWindows: false,
  },
  { id: 'windows', label: 'Windows (x64)', asset: 'soc.exe', isWindows: true },
] as const;

type TokenInfo = {
  token: string;
  expires_at: number;
  display_name: string;
  group_id?: string | null;
};

type TokenListItem = {
  id: string;
  display_name: string;
  used: boolean;
  expired: boolean;
  expires_at: number;
  created_at: number;
};

export default function RegisterAgentPage() {
  const [displayName, setDisplayName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [expiresIn, setExpiresIn] = useState(3600);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [selectedOS, setSelectedOS] = useState<(typeof OS_OPTIONS)[number]>(
    OS_OPTIONS[0],
  );

  useEffect(() => {
    agentApi
      .listGroups()
      .then((res) => setGroups(res.groups))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Display name은 필수입니다.');
      return;
    }
    setLoading(true);

    try {
      const res = await agentApi.createToken(
        displayName.trim(),
        expiresIn,
        groupId || undefined,
      );
      setTokenInfo({
        token: res.token,
        expires_at: res.expires_at,
        display_name: displayName.trim(),
        group_id: groupId || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('토큰 발급에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isAgentLimitError =
    !!error &&
    (error.includes('Free plan') ||
      error.includes('maximum') ||
      error.includes('agents. (Current') ||
      error.includes('최대') ||
      error.includes('Free 플랜') ||
      error.includes('3대'));

  const handleCopy = async () => {
    if (!tokenInfo) return;
    await navigator.clipboard.writeText(tokenInfo.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runCommandForOS = (os: (typeof OS_OPTIONS)[number]) =>
    os.isWindows
      ? `.\\${os.asset} --token "${tokenInfo!.token}"`
      : `./${os.asset} --token "${tokenInfo!.token}"`;

  const handleCopyBlock = async (text: string, blockId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedBlock(blockId);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const handleReset = () => {
    setTokenInfo(null);
    setDisplayName('');
    setGroupId('');
    setCopied(false);
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-[16px] font-semibold text-text-primary">
          Register New Agent
        </h2>
        <p className="text-[13px] text-text-secondary mt-1">
          Generate a registration token for your agent. Use it with the agent
          CLI to register.
        </p>
      </div>

      {!tokenInfo ? (
        /* Step 1: 토큰 발급 */
        <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 sm:p-6">
          <h3 className="text-[14px] font-semibold text-text-primary mb-4">
            Step 1. Generate Token
          </h3>

          {error && (
            <div
              className={`mb-4 p-4 rounded-sm text-[13px] ${
                isAgentLimitError
                  ? 'bg-accent-warning/10 border border-accent-warning/30 text-accent-warning'
                  : 'bg-accent-danger/10 border border-accent-danger/20 text-accent-danger'
              }`}
            >
              <p className="font-medium">{error}</p>
              {isAgentLimitError && (
                <p className="mt-2 text-text-secondary text-[12px]">
                  Upgrade your plan to register more agents.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-text-primary mb-1.5">
                Display Name <span className="text-accent-danger">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Kiosk-Seoul-01"
                className="w-full min-w-0 h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
                required
              />
              <p className="mt-1 text-[12px] text-text-tertiary">
                This name is shown in the dashboard as agent display name.
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-primary mb-1.5">
                Group (optional)
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full min-w-0 h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors cursor-pointer"
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-text-tertiary">
                Selected group rules/alerts/webhooks will apply to this agent
                after registration.
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-primary mb-1.5">
                Token Expiry
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                className="w-full min-w-0 h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors cursor-pointer"
              >
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={7200}>2 hours</option>
                <option value={21600}>6 hours</option>
                <option value={43200}>12 hours</option>
                <option value={86400}>24 hours</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto h-10 px-5 bg-accent-primary hover:bg-accent-primary-hover text-white text-[14px] font-medium rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Generating...' : 'Generate Token'}
            </button>
          </form>
        </div>
      ) : (
        /* Step 2: 토큰 표시 + 설치 안내 */
        <div className="space-y-4">
          {/* 성공 알림 */}
          <div className="p-4 bg-accent-success/10 border border-accent-success/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent-success"
              >
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-[14px] font-semibold text-accent-success">
                Token Generated
              </span>
            </div>
            <p className="text-[13px] text-text-secondary">
              Save this token now. It will not be shown again.
            </p>
          </div>

          {/* 토큰 카드 */}
          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-[14px] font-semibold text-text-primary">
                Registration Token
              </h3>
              {tokenInfo.display_name && (
                <span className="text-[12px] text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
                  {tokenInfo.display_name}
                </span>
              )}
            </div>
            {tokenInfo.group_id && (
              <p className="text-[12px] text-text-tertiary mb-3">
                Group:{' '}
                {groups.find((g) => g.id === tokenInfo.group_id)?.name ||
                  tokenInfo.group_id}
              </p>
            )}

            <div className="relative">
              <div className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 pr-12 font-mono text-[13px] break-all leading-relaxed">
                {tokenInfo.token}
              </div>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                title="Copy token"
              >
                {copied ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>

            <p className="mt-2 text-[12px] text-text-tertiary">
              Expires at{' '}
              {new Date(tokenInfo.expires_at * 1000).toLocaleString('ko-KR')}
            </p>
          </div>

          {/* Install + Run by OS */}
          <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm p-4 sm:p-6">
            <h3 className="text-[14px] font-semibold text-text-primary mb-3">
              Step 2. Install and run on your machine
            </h3>
            <p className="text-[12px] text-text-tertiary mb-4">
              Select your OS, then run the commands in order.
            </p>

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Your OS
              </label>
              <select
                value={selectedOS.id}
                onChange={(e) => {
                  const os = OS_OPTIONS.find((o) => o.id === e.target.value);
                  if (os) setSelectedOS(os);
                }}
                className="w-full min-w-0 h-9 px-3 text-[13px] bg-bg-primary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus cursor-pointer"
              >
                {OS_OPTIONS.map((os) => (
                  <option key={os.id} value={os.id}>
                    {os.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Download */}
            <div className="mb-4">
              <p className="text-[12px] font-medium text-text-primary mb-1.5">
                2a. Download the agent
              </p>
              <div className="relative">
                <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 pr-12 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap break-all">
                  {selectedOS.isWindows
                    ? `Invoke-WebRequest -Uri "${AGENT_RELEASE_BASE}/${selectedOS.asset}" -OutFile "${selectedOS.asset}"`
                    : `curl -sSL -o ${selectedOS.asset} "${AGENT_RELEASE_BASE}/${selectedOS.asset}"\nchmod +x ${selectedOS.asset}`}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyBlock(
                      selectedOS.isWindows
                        ? `Invoke-WebRequest -Uri "${AGENT_RELEASE_BASE}/${selectedOS.asset}" -OutFile "${selectedOS.asset}"`
                        : `curl -sSL -o ${selectedOS.asset} "${AGENT_RELEASE_BASE}/${selectedOS.asset}"\nchmod +x ${selectedOS.asset}`,
                      'download',
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                  title="Copy"
                >
                  {copiedBlock === 'download' ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Run with token */}
            <div className="mb-4">
              <p className="text-[12px] font-medium text-text-primary mb-1.5">
                2b. Run with your token
              </p>
              <div className="relative">
                <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 pr-12 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap break-all">
                  {selectedOS.isWindows ? 'PS> ' : '$ '}
                  {runCommandForOS(selectedOS)}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyBlock(runCommandForOS(selectedOS), 'run')
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                  title="Copy"
                >
                  {copiedBlock === 'run' ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Optional: install as `soc` so you can run from anywhere */}
            <div className="mb-4">
              <p className="text-[12px] font-medium text-text-primary mb-1.5">
                2c. (Optional) Install as{' '}
                <code className="bg-bg-tertiary px-1 rounded text-[11px]">
                  soc
                </code>{' '}
                command
              </p>
              <p className="text-[11px] text-text-tertiary mb-2">
                After this, you can run{' '}
                <code className="bg-bg-tertiary px-0.5 rounded">
                  soc --token &quot;...&quot;
                </code>{' '}
                from any directory.
              </p>
              {selectedOS.isWindows ? (
                <div className="space-y-2">
                  <div className="relative">
                    <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 pr-12 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap break-all">
                      {`# Create a bin folder and copy soc.exe
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\bin" | Out-Null
Copy-Item ${selectedOS.asset} "$env:USERPROFILE\\bin\\soc.exe"

# Add to PATH (current user): run this once, then restart the terminal
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:USERPROFILE\\bin", "User")`}
                    </pre>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyBlock(
                          `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\bin" | Out-Null\nCopy-Item ${selectedOS.asset} "$env:USERPROFILE\\bin\\soc.exe"\n[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:USERPROFILE\\bin", "User")`,
                          'install',
                        )
                      }
                      className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                      title="Copy"
                    >
                      {copiedBlock === 'install' ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-text-tertiary">
                    Restart your terminal, then run:{' '}
                    <code className="bg-bg-tertiary px-0.5 rounded">
                      soc --token &quot;...&quot;
                    </code>
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <pre className="bg-[#1e1e2e] text-[#a6adc8] rounded-sm p-4 pr-12 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap break-all">
                    {`sudo mv ${selectedOS.asset} /usr/local/bin/soc && chmod +x /usr/local/bin/soc`}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyBlock(
                        `sudo mv ${selectedOS.asset} /usr/local/bin/soc && chmod +x /usr/local/bin/soc`,
                        'install',
                      )
                    }
                    className="absolute top-3 right-3 p-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                    title="Copy"
                  >
                    {copiedBlock === 'install' ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* <div className="p-3 bg-bg-tertiary rounded-sm text-[12px] text-text-secondary space-y-1">
              <p>The agent will:</p>
              <p className="pl-3">1. Validate the token with the server</p>
              <p className="pl-3">2. Provision an AWS IoT Core certificate</p>
              <p className="pl-3">3. Store credentials locally (encrypted)</p>
              <p className="pl-3">4. Connect via MQTT and start monitoring</p>
            </div> */}
          </div>

          <button
            onClick={handleReset}
            className="text-[13px] text-accent-primary hover:text-accent-primary-hover font-medium cursor-pointer"
          >
            Generate another token
          </button>
        </div>
      )}

      {/* 기존 토큰 목록 */}
      <TokenHistory />
    </div>
  );
}

function TokenHistory() {
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentApi
      .listTokens()
      .then((res) => setTokens(res.tokens))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || tokens.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-[14px] font-semibold text-text-primary mb-3">
        Token History
      </h3>
      <div className="bg-bg-secondary rounded-md border border-border-primary shadow-sm divide-y divide-border-primary overflow-hidden">
        {tokens.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <div className="text-[13px] font-medium text-text-primary">
                {t.display_name || 'Unnamed token'}
              </div>
              <div className="text-[12px] text-text-tertiary">
                Created{' '}
                {new Date(t.created_at * 1000).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {t.used ? (
                <span className="text-[12px] font-medium text-accent-success bg-accent-success/10 px-2 py-0.5 rounded-full">
                  Used
                </span>
              ) : t.expired ? (
                <span className="text-[12px] font-medium text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
                  Expired
                </span>
              ) : (
                <span className="text-[12px] font-medium text-accent-warning bg-accent-warning/10 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
