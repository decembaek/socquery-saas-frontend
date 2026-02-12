const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// ─── 토큰 관리 ───

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('access_token');
  }
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refresh_token');
  }
  return null;
}

export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('refresh_token', token);
  }
}

export function clearTokens() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

// ─── API Error ───

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ─── Fetch Wrapper ───

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // 401이면 토큰 갱신 시도
  if (res.status === 401 && token) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        const data = (await retryRes.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        throw new ApiError(
          retryRes.status,
          (data.error as string) || 'Request failed',
          data,
        );
      }
      return retryRes.json();
    } else {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throw new ApiError(
      res.status,
      (data.error as string) || `HTTP ${res.status}`,
      data,
    );
  }

  return res.json();
}

// Refresh Token Rotation 동시 호출 보호
// 여러 요청이 동시에 401을 받아도 refresh는 단 1회만 실행
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // 이미 refresh 진행 중이면 같은 Promise를 공유
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ─── Auth API ───

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  account_id: string;
  status?: string;
  created_at?: number;
  updated_at?: number;
};

export const authApi = {
  register(email: string, password: string, name: string) {
    return apiFetch<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  login(email: string, password: string) {
    return apiFetch<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return apiFetch<{ user: User; current_account_id: string }>('/auth/me');
  },

  listAccounts() {
    return apiFetch<{ accounts: { id: string; name: string }[] }>(
      '/auth/accounts',
    );
  },

  switchAccount(accountId: string) {
    return apiFetch<{
      access_token: string;
      expires_in: number;
    }>('/auth/switch-account', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    });
  },

  logout() {
    const refreshToken = getRefreshToken();
    return apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).finally(() => clearTokens());
  },
};

// ─── Agent API ───

export type Agent = {
  id: string;
  account_id: string;
  group_id?: string | null;
  thing_name: string;
  machine_id: string | null;
  display_name: string;
  name: string;
  description: string;
  status: 'online' | 'offline' | 'revoked';
  os: string;
  arch: string;
  version: string;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
};

export type AgentEvent = {
  id: string;
  agent_id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: number;
};

export type AgentCommand = {
  id: string;
  agent_id: string;
  action: string;
  params: Record<string, unknown>;
  status: string;
  exit_code: number | null;
  result: unknown;
  error: string | null;
  created_at: number;
  completed_at: number | null;
};

export type AgentGroup = {
  id: string;
  account_id: string;
  name: string;
  category: 'store' | 'region' | 'device_type' | 'customer';
  description: string;
  created_at: number;
  updated_at: number;
  agent_count?: number;
};

export type AgentGroupRule = {
  id: string;
  group_id: string;
  account_id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: string;
  severity: 'info' | 'warning' | 'critical';
  window_seconds: number;
  enabled: number;
  webhook_url: string | null;
  created_at: number;
  updated_at: number;
};

export type AgentGroupAlertChannel = {
  id: string;
  group_id: string;
  account_id: string;
  type: 'email' | 'webhook';
  target: string;
  webhook_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null;
  webhook_headers: string | null;
  webhook_body: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export type AgentAlertOccurrence = {
  id: string;
  account_id: string;
  group_id: string;
  agent_id: string;
  rule_id: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  anomaly_type: string;
  anomaly_data: Record<string, unknown>;
  created_at: number;
  agent_display_name?: string | null;
  agent_thing_name?: string | null;
  rule_name?: string | null;
};

export const agentApi = {
  // 등록 토큰
  createToken(displayName: string, expiresIn?: number, groupId?: string) {
    return apiFetch<{
      token: string;
      expires_at: number;
      display_name: string;
    }>('/agents/tokens', {
      method: 'POST',
      body: JSON.stringify({
        display_name: displayName,
        expires_in: expiresIn,
        group_id: groupId,
      }),
    });
  },

  listTokens() {
    return apiFetch<{
      tokens: Array<{
        id: string;
        display_name: string;
        name: string;
        used: boolean;
        expired: boolean;
        expires_at: number;
        created_at: number;
      }>;
    }>('/agents/tokens');
  },

  // 장비 CRUD
  list(params?: {
    status?: string;
    group_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.group_id) qs.set('group_id', params.group_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<{ agents: Agent[]; total: number }>(`/agents${query}`);
  },

  get(id: string) {
    return apiFetch<{ agent: Agent }>(`/agents/${id}`);
  },

  update(
    id: string,
    data: { name?: string; description?: string; group_id?: string | null },
  ) {
    return apiFetch(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string) {
    return apiFetch(`/agents/${id}`, { method: 'DELETE' });
  },

  // 이벤트
  getEvents(id: string, params?: { type?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<{ events: AgentEvent[] }>(`/agents/${id}/events${query}`);
  },

  // 명령
  sendCommand(
    id: string,
    action: string,
    params?: Record<string, unknown>,
    timeout?: number,
  ) {
    return apiFetch<{ commandId: string; status: string }>(
      `/agents/${id}/commands`,
      {
        method: 'POST',
        body: JSON.stringify({ action, params, timeout }),
      },
    );
  },

  getCommands(id: string, params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<{ commands: AgentCommand[] }>(
      `/agents/${id}/commands${query}`,
    );
  },

  // 그룹
  listGroups() {
    return apiFetch<{ groups: AgentGroup[] }>('/agents/groups');
  },

  getGroup(id: string) {
    return apiFetch<{ group: AgentGroup }>(`/agents/groups/${id}`);
  },

  createGroup(data: {
    name: string;
    category?: 'store' | 'region' | 'device_type' | 'customer';
    description?: string;
  }) {
    return apiFetch<{ id: string; ok: boolean }>('/agents/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateGroup(
    id: string,
    data: {
      name?: string;
      category?: 'store' | 'region' | 'device_type' | 'customer';
      description?: string;
    },
  ) {
    return apiFetch<{ ok: boolean }>(`/agents/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteGroup(id: string) {
    return apiFetch<{ ok: boolean }>(`/agents/groups/${id}`, {
      method: 'DELETE',
    });
  },

  listGroupRules(groupId: string) {
    return apiFetch<{ rules: AgentGroupRule[] }>(
      `/agents/groups/${groupId}/rules`,
    );
  },

  createGroupRule(
    groupId: string,
    data: {
      name: string;
      metric: string;
      operator: string;
      threshold: string;
      severity?: 'info' | 'warning' | 'critical';
      window_seconds?: number;
      enabled?: boolean;
      webhook_url?: string;
    },
  ) {
    return apiFetch<{ id: string; ok: boolean }>(
      `/agents/groups/${groupId}/rules`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  updateGroupRule(
    groupId: string,
    ruleId: string,
    data: Partial<{
      name: string;
      metric: string;
      operator: string;
      threshold: string;
      severity: 'info' | 'warning' | 'critical';
      window_seconds: number;
      enabled: boolean;
      webhook_url: string;
    }>,
  ) {
    return apiFetch<{ ok: boolean }>(
      `/agents/groups/${groupId}/rules/${ruleId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  },

  deleteGroupRule(groupId: string, ruleId: string) {
    return apiFetch<{ ok: boolean }>(
      `/agents/groups/${groupId}/rules/${ruleId}`,
      {
        method: 'DELETE',
      },
    );
  },

  listGroupAlertChannels(groupId: string) {
    return apiFetch<{ channels: AgentGroupAlertChannel[] }>(
      `/agents/groups/${groupId}/alert-channels`,
    );
  },

  createGroupAlertChannel(
    groupId: string,
    data: {
      type: 'email' | 'webhook';
      target: string;
      enabled?: boolean;
      webhook_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      webhook_headers?: Record<string, string>;
      webhook_body?: string;
    },
  ) {
    return apiFetch<{ id: string; ok: boolean }>(
      `/agents/groups/${groupId}/alert-channels`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  updateGroupAlertChannel(
    groupId: string,
    channelId: string,
    data: {
      target?: string;
      enabled?: boolean;
      webhook_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      webhook_headers?: Record<string, string>;
      webhook_body?: string;
    },
  ) {
    return apiFetch<{ ok: boolean }>(
      `/agents/groups/${groupId}/alert-channels/${channelId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  },

  deleteGroupAlertChannel(groupId: string, channelId: string) {
    return apiFetch<{ ok: boolean }>(
      `/agents/groups/${groupId}/alert-channels/${channelId}`,
      {
        method: 'DELETE',
      },
    );
  },

  listGroupAlerts(
    groupId: string,
    params?: { limit?: number; offset?: number },
  ) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<{ alerts: AgentAlertOccurrence[]; total: number }>(
      `/agents/groups/${groupId}/alerts${query}`,
    );
  },
};
