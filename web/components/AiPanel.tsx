"use client";

import { useEffect, useRef, useState } from "react";
import { runAi } from "./api";

export type AiTaskStatus = "running" | "done" | "error";

export interface AiTask {
  id: string;
  prompt: string;
  status: AiTaskStatus;
  result?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [
  "修复当前项目报错",
  "解释当前目录结构",
  "为最近的改动写一份提交信息",
];

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AiPanel({ open, onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRefs = useRef(new Map<string, AbortController>());

  // 打开抽屉时自动聚焦输入框（移动端避免软键盘抢屏：仅桌面聚焦）
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) inputRef.current?.focus();
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ctrl = new AbortController();
    abortRefs.current.set(id, ctrl);

    const task: AiTask = {
      id,
      prompt: text,
      status: "running",
      startedAt: Date.now(),
    };
    setTasks((prev) => [task, ...prev]);
    setPrompt("");

    const resp = await runAi(text, ctrl.signal);
    abortRefs.current.delete(id);
    setTasks((prev) =>
      prev.map((t) =>
        t.id !== id
          ? t
          : {
              ...t,
              status: resp.error ? "error" : "done",
              result: resp.result,
              error: resp.error,
              endedAt: Date.now(),
            },
      ),
    );
  };

  const cancelTask = (id: string) => {
    const ctrl = abortRefs.current.get(id);
    if (ctrl) {
      ctrl.abort();
      abortRefs.current.delete(id);
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id !== id || t.status !== "running"
          ? t
          : { ...t, status: "error", error: "已取消", endedAt: Date.now() },
      ),
    );
  };

  const removeTask = (id: string) => {
    cancelTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter 提交
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit(prompt);
    }
  };

  return (
    <>
      <div
        className={`backdrop ${open ? "show" : ""}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`panel ${open ? "open" : ""}`}
        role="dialog"
        aria-label="Claude 任务面板"
      >
        <header className="panel-header">
          <div className="panel-title">
            <span className="ai-dot" />
            <span>Claude 任务</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              className="preset-chip"
              onClick={() => submit(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="task-list">
          {tasks.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🤖</div>
              <div className="empty-text">
                还没有任务。输入一段 prompt，让 Claude 帮你处理。
              </div>
            </div>
          ) : (
            tasks.map((t) => {
              const dur = (t.endedAt ?? Date.now()) - t.startedAt;
              return (
                <article
                  key={t.id}
                  className={`task-card status-${t.status}`}
                >
                  <header className="task-head">
                    <span className={`badge badge-${t.status}`}>
                      {t.status === "running"
                        ? "运行中"
                        : t.status === "done"
                          ? "完成"
                          : "失败"}
                    </span>
                    <span className="task-time">{formatDuration(dur)}</span>
                    {t.status === "running" ? (
                      <button
                        className="text-btn"
                        onClick={() => cancelTask(t.id)}
                      >
                        取消
                      </button>
                    ) : (
                      <button
                        className="text-btn"
                        onClick={() => removeTask(t.id)}
                      >
                        移除
                      </button>
                    )}
                  </header>
                  <pre className="task-prompt">{t.prompt}</pre>
                  {t.status === "running" && (
                    <div className="task-loading">
                      <span className="spinner" />
                      正在调用 Claude…
                    </div>
                  )}
                  {t.status === "done" && t.result && (
                    <pre className="task-result">{t.result}</pre>
                  )}
                  {t.status === "error" && (
                    <pre className="task-error">{t.error ?? "未知错误"}</pre>
                  )}
                </article>
              );
            })
          )}
        </div>

        <footer className="composer">
          <textarea
            ref={inputRef}
            className="composer-input"
            placeholder="告诉 Claude 你想做什么…（⌘/Ctrl + Enter 发送）"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
          />
          <button
            className="send-btn"
            onClick={() => submit(prompt)}
            disabled={!prompt.trim()}
          >
            发送
          </button>
        </footer>
      </aside>

      <style jsx>{`
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 50;
        }
        .backdrop.show {
          opacity: 1;
          pointer-events: auto;
        }

        .panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(420px, 100vw);
          background: #0e131c;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          color: #d6deeb;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
          z-index: 51;
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-right: env(safe-area-inset-right);
          box-shadow: -16px 0 40px rgba(0, 0, 0, 0.5);
        }
        .panel.open {
          transform: translateX(0);
        }

        .panel-header {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .panel-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
        }
        .ai-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7fdbca, #82aaff);
          box-shadow: 0 0 10px rgba(127, 221, 202, 0.6);
        }
        .icon-btn {
          appearance: none;
          background: transparent;
          color: rgba(214, 222, 235, 0.7);
          border: 0;
          font-size: 16px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
        }
        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .presets {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .preset-chip {
          appearance: none;
          background: rgba(127, 221, 202, 0.08);
          border: 1px solid rgba(127, 221, 202, 0.2);
          color: #b8e6dc;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .preset-chip:hover {
          background: rgba(127, 221, 202, 0.16);
        }

        .task-list {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .empty {
          margin: auto;
          text-align: center;
          color: rgba(214, 222, 235, 0.5);
          padding: 30px 10px;
        }
        .empty-icon {
          font-size: 36px;
          opacity: 0.6;
          margin-bottom: 8px;
        }
        .empty-text {
          font-size: 13px;
          line-height: 1.6;
        }

        .task-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .task-card.status-running {
          border-color: rgba(241, 196, 15, 0.3);
        }
        .task-card.status-done {
          border-color: rgba(34, 218, 110, 0.25);
        }
        .task-card.status-error {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .task-head {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 600;
        }
        .badge-running {
          background: rgba(241, 196, 15, 0.15);
          color: #f1c40f;
        }
        .badge-done {
          background: rgba(34, 218, 110, 0.15);
          color: #22da6e;
        }
        .badge-error {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        .task-time {
          font-size: 11px;
          color: rgba(214, 222, 235, 0.55);
          margin-left: auto;
        }
        .text-btn {
          appearance: none;
          background: transparent;
          color: rgba(214, 222, 235, 0.7);
          border: 0;
          font-size: 12px;
          padding: 2px 4px;
          cursor: pointer;
        }
        .text-btn:hover {
          color: #fff;
        }

        .task-prompt,
        .task-result,
        .task-error {
          margin: 0;
          padding: 8px 10px;
          border-radius: 6px;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 320px;
          overflow: auto;
        }
        .task-prompt {
          background: rgba(130, 170, 255, 0.06);
          color: #c8d3eb;
        }
        .task-result {
          background: rgba(34, 218, 110, 0.06);
          color: #d6eedb;
        }
        .task-error {
          background: rgba(239, 68, 68, 0.06);
          color: #f3c4c4;
        }

        .task-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(241, 196, 15, 0.85);
          font-size: 12px;
        }
        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(241, 196, 15, 0.3);
          border-top-color: #f1c40f;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .composer {
          flex: 0 0 auto;
          display: flex;
          gap: 8px;
          padding: 10px 12px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(11, 15, 23, 0.6);
        }
        .composer-input {
          flex: 1 1 auto;
          resize: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px;
          color: #d6deeb;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .composer-input:focus {
          border-color: rgba(127, 221, 202, 0.5);
        }
        .send-btn {
          appearance: none;
          border: 0;
          color: #0b0f17;
          background: linear-gradient(135deg, #7fdbca 0%, #82aaff 100%);
          font-weight: 600;
          font-size: 13px;
          padding: 0 16px;
          border-radius: 10px;
          cursor: pointer;
          align-self: stretch;
          transition: opacity 0.15s ease;
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .panel {
            width: 100vw;
            border-left: none;
          }
        }
      `}</style>
    </>
  );
}
