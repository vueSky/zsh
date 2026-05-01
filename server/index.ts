import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { createTerminal } from "./terminal";
import { runAI, streamAI } from "./ai";

try { require("dotenv").config(); } catch {}

const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
if (!AUTH_PASSWORD) {
  console.error("❌  AUTH_PASSWORD 未设置，请在 server/.env 中配置后重启");
  process.exit(1);
}

// ── Token 持久化（重启后 session 不丢失）────────────────────────────────────
const TOKENS_FILE = path.join(__dirname, ".tokens.json");
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30天

function loadTokens(): Map<string, number> {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const map = new Map<string, number>();
    for (const [token, expiry] of Object.entries(data)) {
      if (expiry > now) map.set(token, expiry); // 过期的直接丢弃
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveTokens(tokens: Map<string, number>): void {
  const data: Record<string, number> = {};
  for (const [token, expiry] of tokens) data[token] = expiry;
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(data));
  } catch (e) {
    console.error("❌  token 持久化失败:", e);
  }
}

const validTokens = loadTokens();
console.log(`✅  已加载 ${validTokens.size} 个持久化 token`);

function issueToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  validTokens.set(token, Date.now() + TOKEN_TTL);
  saveTokens(validTokens);
  return token;
}

function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const expiry = validTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    validTokens.delete(token);
    saveTokens(validTokens);
    return false;
  }
  return true;
}

// ── 频率限制（防暴力破解登录）────────────────────────────────────────────────
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min 窗口
const RATE_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: Math.floor(process.uptime()) });
});

// 登录
app.post("/auth", (req, res) => {
  const ip = String(req.ip ?? req.socket.remoteAddress ?? "unknown");
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "尝试次数过多，请 15 分钟后再试" });
  }
  const { password } = req.body;
  if (password !== AUTH_PASSWORD) {
    return res.status(401).json({ error: "密码错误" });
  }
  res.json({ token: issueToken() });
});

// 登出（撤销当前 token）
app.post("/auth/logout", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? null;
  if (token && validTokens.has(token)) {
    validTokens.delete(token);
    saveTokens(validTokens);
  }
  res.json({ ok: true });
});

// AI 完整输出
app.post("/ai", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? null;
  if (!isValidToken(token)) return res.status(401).send("Unauthorized");
  const { prompt } = req.body;
  try {
    const result = await runAI(prompt);
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// AI 流式输出（SSE）
app.post("/ai/stream", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? null;
  if (!isValidToken(token)) return res.status(401).send("Unauthorized");

  const { prompt } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const ctrl = new AbortController();
  req.on("close", () => ctrl.abort());

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await streamAI(prompt, (chunk) => send("chunk", chunk), ctrl.signal);
    send("done", null);
  } catch (e) {
    if (!ctrl.signal.aborted) send("error", String(e));
  } finally {
    res.end();
  }
});

// 打开桌面应用
const ALLOWED_APPS: Record<string, string> = {
  codex: "/Applications/Codex.app",
};

app.post("/app/open", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? null;
  if (!isValidToken(token)) return res.status(401).send("Unauthorized");
  const { app: appName } = req.body as { app?: string };
  const appPath = appName && ALLOWED_APPS[appName.toLowerCase()];
  if (!appPath) return res.status(400).json({ error: "未知应用" });
  execFile("open", ["-a", appPath], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

const server = app.listen(3001, () => {
  console.log("🚀  Server running http://localhost:3001");
});

// ── WebSocket 终端 ────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, "http://localhost");
  const token = url.searchParams.get("token");

  if (!isValidToken(token)) {
    ws.close(4001, "Unauthorized");
    return;
  }

  const term = createTerminal((data) => {
    ws.send(JSON.stringify({ type: "output", data }));
  });

  ws.on("message", (msg) => {
    try {
      const { type, data } = JSON.parse(msg.toString());
      if (type === "input") term.write(data);
      else if (type === "resize") term.resize(data.cols, data.rows);
    } catch { /* ignore malformed */ }
  });

  ws.on("close", () => term.kill());
});
