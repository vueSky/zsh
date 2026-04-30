// 后端通信常量与工具：被 TerminalPane / AiPanel 共用
export const TOKEN =
  "7fcd45c24ce1c8106e3171c153b9255b7248c66006ca0ae05226e666829dad3d";
export const SERVER_PORT = 3001;

// 局域网/本机 host 判定：这些场景直连 SERVER_PORT，不依赖任何 tunnel
function isLocalOrLan(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".local")) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

// URL 选择策略（避免 tunnel 死掉时本地也连不上）：
//   1) SSR：占位返回（前端 useEffect 才用）
//   2) 浏览器在局域网/本机访问 → 直连同 host:SERVER_PORT
//   3) 浏览器从公网域名访问且配置了 NEXT_PUBLIC_SERVER_URL → 走 tunnel
//   4) 公网访问但未配置 → 兜底回退到同 host:SERVER_PORT（多半被防火墙挡，但留个 fallback）
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

export interface AiResponse {
  result?: string;
  error?: string;
}

// 调用后端 /ai：复用单一接口
export async function runAi(
  prompt: string,
  signal?: AbortSignal,
): Promise<AiResponse> {
  const { httpBase } = buildServerUrls();
  try {
    const res = await fetch(`${httpBase}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `HTTP ${res.status}${text ? `: ${text}` : ""}` };
    }
    return (await res.json()) as AiResponse;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
