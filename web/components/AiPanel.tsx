"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamAi } from "./api";

// ── 类型 ──────────────────────────────────────────────────────────────────────

type Mode = "qa" | "code";
export type AiTaskStatus = "running" | "done" | "error" | "injected";

export interface AiTask {
  id: string;
  mode: Mode;
  project?: string;
  prompt: string;
  status: AiTaskStatus;
  result?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

interface DirShortcut { id: string; name: string; path: string; }

// ── 持久化 ───────────────────────────────────────────────────────────────────

const TASK_KEY = "mdc_task_history";
const MODE_KEY = "mdc_ai_mode";
const PROJECT_KEY = "mdc_ai_project";
const DIR_KEY = "mdc_dir_shortcuts";
const MAX_HISTORY = 60;

function loadTasks(): AiTask[] {
  try {
    const raw = localStorage.getItem(TASK_KEY);
    return raw ? (JSON.parse(raw) as AiTask[]) : [];
  } catch { return []; }
}

function saveTasks(tasks: AiTask[]): void {
  localStorage.setItem(TASK_KEY, JSON.stringify(tasks.slice(0, MAX_HISTORY)));
}

function loadDirs(): DirShortcut[] {
  try {
    const raw = localStorage.getItem(DIR_KEY);
    return raw ? (JSON.parse(raw) as DirShortcut[]) : [];
  } catch { return []; }
}

// ── 辅助 ─────────────────────────────────────────────────────────────────────

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function escapeShell(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// 流式结果块，text 变化时自动滚底
function StreamResult({ text, streaming }: { text: string; streaming: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (streaming && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [text, streaming]);
  return (
    <pre ref={ref} className={`result${streaming ? " streaming" : ""}`}>
      {text}
      {streaming && <span className="cursor" aria-hidden>▌</span>}
    </pre>
  );
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

const QA_PRESETS = [
  "修复当前项目报错",
  "解释当前目录结构",
  "为最近的改动写一份提交信息",
];

const CODE_PRESETS = [
  "修复所有 TypeScript 报错",
  "为所有函数补充注释",
  "重构并优化代码结构",
  "添加单元测试",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onInjectToTerminal: (text: string) => void;
}

export default function AiPanel({ open, onClose, onInjectToTerminal }: Props) {
  const [mode, setMode] = useState<Mode>(
    () => (typeof window !== "undefined" ? (localStorage.getItem(MODE_KEY) as Mode) ?? "qa" : "qa"),
  );
  const [project, setProject] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(PROJECT_KEY) ?? "" : ""),
  );
  const [dirs, setDirs] = useState<DirShortcut[]>([]);
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRefs = useRef(new Map<string, AbortController>());

  // 初始化：从 localStorage 加载历史和目录列表
  useEffect(() => {
    setTasks(loadTasks());
    setDirs(loadDirs());
  }, []);

  // 面板打开时刷新目录列表（DirShortcuts 可能更新过）
  useEffect(() => {
    if (open) setDirs(loadDirs());
  }, [open]);

  // 运行中任务实时计时
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === "running");
    if (!hasRunning) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [tasks]);
  void tick;

  // 聚焦 & ESC
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 持久化 mode / project
  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  const selectProject = useCallback((p: string) => {
    setProject(p);
    localStorage.setItem(PROJECT_KEY, p);
  }, []);

  // ── 提交 ─────────────────────────────────────────────────────────────────

  const updateTasks = useCallback((next: AiTask[]) => {
    setTasks(next);
    saveTasks(next);
  }, []);

  // 问答模式：调用 /ai/stream
  const submitQa = useCallback(async (text: string) => {
    const id = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ctrl = new AbortController();
    abortRefs.current.set(id, ctrl);

    const newTask: AiTask = { id, mode: "qa", prompt: text, status: "running", startedAt: Date.now() };
    setTasks((prev) => { const next = [newTask, ...prev]; saveTasks(next); return next; });
    setPrompt("");
    requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = 0; });

    try {
      await streamAi(
        text,
        (chunk) => {
          setTasks((prev) =>
            prev.map((t) => t.id !== id ? t : { ...t, result: (t.result ?? "") + chunk }),
          );
        },
        ctrl.signal,
      );
      setTasks((prev) => {
        const next = prev.map((t) => t.id !== id ? t : { ...t, status: "done" as const, endedAt: Date.now() });
        saveTasks(next);
        return next;
      });
    } catch (e) {
      const msg = ctrl.signal.aborted ? "已取消" : (e instanceof Error ? e.message : String(e));
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id !== id || t.status !== "running" ? t : { ...t, status: "error" as const, error: msg, endedAt: Date.now() },
        );
        saveTasks(next);
        return next;
      });
    } finally {
      abortRefs.current.delete(id);
    }
  }, []);

  // 写代码模式：向终端注入 claude 命令
  const submitCode = useCallback((text: string) => {
    const id = `code_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dir = project || "~";
    const cmd = `\x15cd ${dir} && claude --dangerously-skip-permissions "${escapeShell(text)}"\r`;

    onInjectToTerminal(cmd);

    const newTask: AiTask = {
      id, mode: "code", project: dir, prompt: text,
      status: "injected", startedAt: Date.now(), endedAt: Date.now(),
    };
    setTasks((prev) => { const next = [newTask, ...prev]; saveTasks(next); return next; });
    setPrompt("");
    requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = 0; });
    onClose(); // 关闭面板，让用户看到终端中的 claude 运行状态
  }, [project, onInjectToTerminal, onClose]);

  const submit = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (mode === "code") submitCode(text);
    else void submitQa(text);
  }, [mode, submitCode, submitQa]);

  // ── git 快捷操作（注入到终端）─────────────────────────────────────────────

  const gitAction = useCallback((gitCmd: string) => {
    const dir = project || "~";
    onInjectToTerminal(`\x15cd ${dir} && ${gitCmd}\r`);
    onClose();
  }, [project, onInjectToTerminal, onClose]);

  // ── 任务管理 ─────────────────────────────────────────────────────────────

  const cancelTask = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);
  }, []);

  const removeTask = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);
    setTasks((prev) => { const next = prev.filter((t) => t.id !== id); saveTasks(next); return next; });
  }, []);

  const clearDone = useCallback(() => {
    setTasks((prev) => { const next = prev.filter((t) => t.status === "running"); saveTasks(next); return next; });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(prompt); }
  };

  const hasDone = tasks.some((t) => t.status !== "running");
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const presets = mode === "code" ? CODE_PRESETS : QA_PRESETS;

  return (
    <>
      <div className={`backdrop ${open ? "show" : ""}`} onClick={onClose} aria-hidden />
      <aside className={`panel ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Claude 面板">

        {/* ── 顶栏 ── */}
        <header className="panel-header">
          <div className="panel-title">
            <span className="ai-dot" />
            <span>Claude</span>
            {runningCount > 0 && <span className="running-badge">{runningCount}</span>}
          </div>
          <div className="header-right">
            {hasDone && <button className="clear-btn" type="button" onClick={clearDone}>清空已完成</button>}
            <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
          </div>
        </header>

        {/* ── 模式切换 ── */}
        <div className="mode-row">
          <button
            className={`mode-btn ${mode === "qa" ? "active" : ""}`}
            type="button"
            onClick={() => switchMode("qa")}
          >
            💬 问答
          </button>
          <button
            className={`mode-btn ${mode === "code" ? "active" : ""}`}
            type="button"
            onClick={() => switchMode("code")}
          >
            ⚡ 写代码
          </button>

          {/* 写代码模式：项目选择器 */}
          {mode === "code" && (
            <select
              className="project-select"
              value={project}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="选择工作目录"
            >
              <option value="">选择项目目录…</option>
              {dirs.map((d) => (
                <option key={d.id} value={d.path}>{d.name} ({d.path})</option>
              ))}
              <option value="~">~ (Home)</option>
            </select>
          )}
        </div>

        {/* 写代码模式：git 快捷操作 */}
        {mode === "code" && (
          <div className="git-row">
            <span className="git-label">Git</span>
            <button className="git-btn" type="button" onClick={() => gitAction("git status")}>status</button>
            <button className="git-btn" type="button" onClick={() => gitAction("git diff")}>diff</button>
            <button className="git-btn" type="button" onClick={() => gitAction("git log --oneline -10")}>log</button>
            <button className="git-btn" type="button" onClick={() => gitAction('git add -A && git commit -m "chore: claude auto commit"')}>commit</button>
          </div>
        )}

        {/* ── 预设 ── */}
        <div className="presets">
          {presets.map((p) => (
            <button key={p} className="preset-chip" type="button" onClick={() => submit(p)}>
              {p}
            </button>
          ))}
        </div>

        {/* ── 任务列表 ── */}
        <div className="task-list" ref={listRef}>
          {tasks.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">🤖</span>
              <p className="empty-text">
                {mode === "code"
                  ? "选好项目目录，输入需求，Claude 会直接在终端里编写代码。"
                  : "输入 prompt，Claude 会直接回答你的问题。"}
              </p>
            </div>
          ) : (
            tasks.map((t) => {
              const dur = (t.endedAt ?? Date.now()) - t.startedAt;
              return (
                <article key={t.id} className={`task-card status-${t.status}`}>
                  <div className="task-head">
                    <span className={`badge badge-${t.status}`}>
                      {t.status === "running" ? "运行中"
                        : t.status === "done" ? "完成"
                        : t.status === "injected" ? "已注入终端"
                        : "失败"}
                    </span>
                    {t.mode === "code" && t.project && (
                      <span className="task-project" title={t.project}>
                        📁 {t.project.split("/").pop()}
                      </span>
                    )}
                    <span className="task-time">
                      {t.status === "running" ? formatDuration(dur) : formatDuration(dur)}
                    </span>
                    {t.status === "running" ? (
                      <button className="text-btn cancel-btn" type="button" onClick={() => cancelTask(t.id)}>取消</button>
                    ) : (
                      <button className="text-btn" type="button" onClick={() => removeTask(t.id)}>移除</button>
                    )}
                  </div>

                  <pre className="task-prompt">{t.prompt}</pre>

                  {t.status === "running" && !t.result && (
                    <div className="task-loading"><span className="spinner" />正在调用 Claude…</div>
                  )}
                  {t.result && (
                    <StreamResult text={t.result} streaming={t.status === "running"} />
                  )}
                  {t.status === "injected" && (
                    <div className="injected-hint">
                      已发送到终端，Claude 正在 <code>{t.project}</code> 中工作
                    </div>
                  )}
                  {t.status === "error" && (
                    <pre className="task-error">{t.error ?? "未知错误"}</pre>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* ── Composer ── */}
        <footer className="composer">
          <textarea
            ref={inputRef}
            className="composer-input"
            placeholder={
              mode === "code"
                ? "描述你要做什么（Claude 会直接修改代码）…"
                : "问 Claude 任何问题… (⌘/Ctrl+Enter 发送)"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
          />
          <button
            className={`send-btn ${mode === "code" ? "send-code" : ""}`}
            type="button"
            onClick={() => submit(prompt)}
            disabled={!prompt.trim() || (mode === "code" && !project)}
            title={mode === "code" && !project ? "请先选择项目目录" : undefined}
          >
            {mode === "code" ? "执行" : "发送"}
          </button>
        </footer>
      </aside>

      <style jsx>{`
        .backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.2s ease; z-index: 50;
        }
        .backdrop.show { opacity: 1; pointer-events: auto; }

        .panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(440px, 100vw);
          background: #0e131c;
          border-left: 1px solid rgba(255,255,255,0.08);
          color: #d6deeb;
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.25s cubic-bezier(0.2,0.8,0.2,1);
          z-index: 51;
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-right: env(safe-area-inset-right);
          box-shadow: -16px 0 48px rgba(0,0,0,0.55);
        }
        .panel.open { transform: translateX(0); }

        /* 顶栏 */
        .panel-header {
          flex: 0 0 auto; display: flex; align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06); gap: 8px;
        }
        .panel-title { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
        .ai-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: linear-gradient(135deg,#7fdbca,#82aaff);
          box-shadow: 0 0 10px rgba(127,221,202,0.6); flex: 0 0 auto;
        }
        .running-badge {
          font-size: 10px; font-weight: 700;
          min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
          background: rgba(241,196,15,0.2); color: #f1c40f;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .header-right { display: inline-flex; align-items: center; gap: 6px; }
        .clear-btn {
          appearance: none; background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(214,222,235,0.55); font-size: 11px;
          padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;
          transition: color 0.15s, border-color 0.15s;
        }
        .clear-btn:hover { color: rgba(214,222,235,0.9); border-color: rgba(255,255,255,0.2); }
        .icon-btn {
          appearance: none; background: transparent; border: 0;
          color: rgba(214,222,235,0.7); font-size: 16px;
          width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }

        /* 模式切换 */
        .mode-row {
          flex: 0 0 auto; display: flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap;
        }
        .mode-btn {
          appearance: none; font-size: 12px; padding: 5px 12px;
          border-radius: 8px; cursor: pointer; font-weight: 500;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04); color: rgba(214,222,235,0.65);
          transition: all 0.15s ease;
        }
        .mode-btn.active {
          background: rgba(127,221,202,0.12);
          border-color: rgba(127,221,202,0.4); color: #7fdbca;
        }
        .project-select {
          flex: 1 1 auto; min-width: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 5px 8px;
          color: #d6deeb; font-size: 12px; outline: none;
          cursor: pointer;
        }
        .project-select:focus { border-color: rgba(127,221,202,0.4); }

        /* git 快捷操作 */
        .git-row {
          flex: 0 0 auto; display: flex; align-items: center; gap: 5px;
          padding: 5px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          overflow-x: auto; scrollbar-width: none;
        }
        .git-row::-webkit-scrollbar { display: none; }
        .git-label { font-size: 10px; color: rgba(214,222,235,0.4); white-space: nowrap; margin-right: 2px; }
        .git-btn {
          appearance: none; flex: 0 0 auto;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px; padding: 3px 9px;
          color: rgba(214,222,235,0.7); font-size: 11.5px;
          font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace;
          cursor: pointer; white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }
        .git-btn:hover { background: rgba(127,221,202,0.1); color: #7fdbca; border-color: rgba(127,221,202,0.3); }

        /* 预设 */
        .presets {
          flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 6px;
          padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .preset-chip {
          appearance: none;
          background: rgba(127,221,202,0.07); border: 1px solid rgba(127,221,202,0.2);
          color: #a8ddd4; padding: 4px 10px; border-radius: 999px;
          font-size: 12px; cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .preset-chip:hover { background: rgba(127,221,202,0.15); color: #c8ede8; }
        .preset-chip:active { transform: scale(0.97); }

        /* 任务列表 */
        .task-list {
          flex: 1 1 auto; min-height: 0; overflow-y: auto;
          overscroll-behavior: contain;
          padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
          scroll-behavior: smooth;
        }
        .task-list::-webkit-scrollbar { width: 4px; }
        .task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        .empty { margin: auto; text-align: center; color: rgba(214,222,235,0.45); padding: 36px 16px; }
        .empty-icon { font-size: 38px; opacity: 0.5; margin-bottom: 10px; display: block; }
        .empty-text { font-size: 13px; line-height: 1.7; margin: 0; }

        /* 任务卡片 */
        .task-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 8px;
          transition: border-color 0.2s;
        }
        .task-card.status-running { border-color: rgba(241,196,15,0.28); }
        .task-card.status-done    { border-color: rgba(34,218,110,0.22); }
        .task-card.status-error   { border-color: rgba(239,68,68,0.28); }
        .task-card.status-injected { border-color: rgba(130,170,255,0.3); }

        .task-head { display: flex; align-items: center; gap: 6px; }
        .badge {
          font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
          font-weight: 700; flex: 0 0 auto;
        }
        .badge-running  { background: rgba(241,196,15,0.14);  color: #f1c40f; }
        .badge-done     { background: rgba(34,218,110,0.14);  color: #22da6e; }
        .badge-error    { background: rgba(239,68,68,0.14);   color: #ef4444; }
        .badge-injected { background: rgba(130,170,255,0.14); color: #82aaff; }

        .task-project {
          font-size: 11px; color: rgba(214,222,235,0.5);
          max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .task-time { font-size: 11px; color: rgba(214,222,235,0.4); margin-left: auto; font-variant-numeric: tabular-nums; }
        .text-btn {
          appearance: none; background: transparent; border: 0;
          color: rgba(214,222,235,0.5); font-size: 12px; padding: 2px 6px;
          border-radius: 4px; cursor: pointer; flex: 0 0 auto;
          transition: color 0.15s, background 0.15s;
        }
        .text-btn:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .cancel-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

        .task-prompt, :global(.result), .task-error {
          margin: 0; padding: 8px 10px; border-radius: 6px;
          font-size: 12px; line-height: 1.6; white-space: pre-wrap;
          word-break: break-word; max-height: 360px; overflow-y: auto;
          font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace;
        }
        .task-prompt { background: rgba(130,170,255,0.06); color: #b8c8eb; }
        :global(.result)  { background: rgba(34,218,110,0.05);  color: #cce8d8; }
        :global(.result.streaming) { border-left: 2px solid rgba(127,221,202,0.4); }
        :global(.result .cursor) { color: #7fdbca; animation: blink 1s step-end infinite; }
        .task-error { background: rgba(239,68,68,0.05); color: #f0c4c4; }

        .injected-hint {
          font-size: 12px; color: rgba(130,170,255,0.8);
          padding: 6px 10px; border-radius: 6px;
          background: rgba(130,170,255,0.06);
          border-left: 2px solid rgba(130,170,255,0.3);
        }
        .injected-hint code {
          font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace;
          font-size: 11px; opacity: 0.85;
        }

        .task-loading { display: inline-flex; align-items: center; gap: 8px; color: rgba(241,196,15,0.8); font-size: 12px; }
        .spinner {
          width: 12px; height: 12px; flex: 0 0 auto;
          border: 2px solid rgba(241,196,15,0.25); border-top-color: #f1c40f;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }

        /* Composer */
        .composer {
          flex: 0 0 auto; display: flex; gap: 8px;
          padding: 10px 12px 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,14,22,0.85);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        .composer-input {
          flex: 1 1 auto; resize: none;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 10px 12px;
          color: #d6deeb; font-size: 13px; font-family: inherit;
          outline: none; line-height: 1.5; transition: border-color 0.15s;
        }
        .composer-input::placeholder { color: rgba(214,222,235,0.3); }
        .composer-input:focus { border-color: rgba(127,221,202,0.4); }
        .send-btn {
          appearance: none; border: 0; color: #0b0f17;
          background: linear-gradient(135deg,#7fdbca 0%,#82aaff 100%);
          font-weight: 700; font-size: 13px; padding: 0 18px;
          border-radius: 10px; cursor: pointer; align-self: stretch; min-width: 56px;
          transition: opacity 0.15s, transform 0.1s;
        }
        .send-btn.send-code {
          background: linear-gradient(135deg,#c792ea 0%,#82aaff 100%);
        }
        .send-btn:not(:disabled):hover { opacity: 0.9; }
        .send-btn:not(:disabled):active { transform: scale(0.97); }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        @media (max-width: 640px) { .panel { width: 100vw; border-left: none; } }
        @media (max-height: 480px) { .presets, .git-row { display: none; } }
      `}</style>
    </>
  );
}
