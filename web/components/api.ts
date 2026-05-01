export const SERVER_PORT = 3001;

function isLocalOrLan(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".local")) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

export function buildServerUrls() {
  if (typeof window === "undefined") {
    return {
      httpBase: `http://localhost:${SERVER_PORT}`,
      wsBase: `ws://localhost:${SERVER_PORT}`,
    };
  }
  const host = window.location.hostname;
  const isHttps = window.location.protocol === "https:";
  const sameHost = {
    httpBase: `${isHttps ? "https" : "http"}://${host}:${SERVER_PORT}`,
    wsBase: `${isHttps ? "wss" : "ws"}://${host}:${SERVER_PORT}`,
  };
  if (isLocalOrLan(host)) return sameHost;
  const explicit = process.env.NEXT_PUBLIC_SERVER_URL;
  if (explicit) {
    const trimmed = explicit.replace(/\/$/, "");
    return { httpBase: trimmed, wsBase: trimmed.replace(/^http/, "ws") };
  }
  return sameHost;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const TOKEN_KEY = "mdc_auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  const { httpBase } = buildServerUrls();
  try {
    const res = await fetch(`${httpBase}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "登录失败" };
    }
    const { token } = await res.json() as { token: string };
    setToken(token);
    return { ok: true };
  } catch {
    return { ok: false, error: "无法连接服务器" };
  }
}

// ── Auth logout ───────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const { httpBase } = buildServerUrls();
  const token = getToken();
  if (token) {
    await fetch(`${httpBase}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearToken();
}

// ── AI ────────────────────────────────────────────────────────────────────────

export interface AiResponse {
  result?: string;
  error?: string;
}

export async function runAi(
  prompt: string,
  signal?: AbortSignal,
): Promise<AiResponse> {
  const { httpBase } = buildServerUrls();
  const token = getToken();
  try {
    const res = await fetch(`${httpBase}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) {
      if (res.status === 401) clearToken();
      const text = await res.text().catch(() => "");
      return { error: `HTTP ${res.status}${text ? `: ${text}` : ""}` };
    }
    return (await res.json()) as AiResponse;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ── App launcher ──────────────────────────────────────────────────────────────

export async function openApp(appName: string): Promise<void> {
  const { httpBase } = buildServerUrls();
  const token = getToken();
  await fetch(`${httpBase}/app/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify({ app: appName }),
  });
}

// SSE 流式 AI，每收到一段文本就回调 onChunk，完成或出错时 resolve/reject
export function streamAi(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { httpBase } = buildServerUrls();
  const token = getToken();

  return fetch(`${httpBase}/ai/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify({ prompt }),
    signal,
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 401) clearToken();
      throw new Error(`HTTP ${res.status}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // 逐行解析 SSE
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      let event = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const payload = JSON.parse(line.slice(6)) as unknown;
          if (event === "chunk") onChunk(payload as string);
          else if (event === "done") return;
          else if (event === "error") throw new Error(payload as string);
        }
      }
    }
  });
}
