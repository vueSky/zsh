"use client";

import { useCallback, useState } from "react";
import TerminalPane, { ConnState } from "./TerminalPane";
import AiPanel from "./AiPanel";

interface Tab {
  id: string;
  conn: ConnState;
}

const STATUS_COLOR: Record<ConnState, string> = {
  connecting: "#f1c40f",
  open: "#22da6e",
  closed: "#9ca3af",
  error: "#ef4444",
};

const STATUS_TEXT: Record<ConnState, string> = {
  connecting: "连接中…",
  open: "已连接",
  closed: "已断开",
  error: "连接失败",
};

function makeId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function Workspace() {
  const [tabs, setTabs] = useState<Tab[]>(() => [
    { id: makeId(), conn: "connecting" },
  ]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]!.id);
  const [aiOpen, setAiOpen] = useState(false);

  const handleConnChange = useCallback((id: string, conn: ConnState) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, conn } : t)));
  }, []);

  const addTab = useCallback(() => {
    const id = makeId();
    setTabs((prev) => [...prev, { id, conn: "connecting" }]);
    setActiveId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = prev.filter((t) => t.id !== id);
        // 如果关掉的是当前激活 tab，转移焦点到相邻 tab
        if (id === activeId && next.length > 0) {
          const fallback = next[Math.min(idx, next.length - 1)]!;
          setActiveId(fallback.id);
        }
        // 关到空，自动补一个
        if (next.length === 0) {
          const newId = makeId();
          setActiveId(newId);
          return [{ id: newId, conn: "connecting" }];
        }
        return next;
      });
    },
    [activeId],
  );

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title="Mobile Dev Control">
          <span className="logo" />
          <span className="title">Mobile Dev Control</span>
        </div>

        <nav className="tabs" role="tablist" aria-label="终端会话">
          {tabs.map((t, i) => {
            const isActive = t.id === activeTab.id;
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={isActive}
                className={`tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                <span
                  className="tab-dot"
                  style={{
                    background: STATUS_COLOR[t.conn],
                    boxShadow: `0 0 6px ${STATUS_COLOR[t.conn]}`,
                  }}
                />
                <span className="tab-label">终端 {i + 1}</span>
                <button
                  className="tab-close"
                  aria-label="关闭"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="tab-add"
            onClick={addTab}
            aria-label="新建终端"
            title="新建终端"
          >
            +
          </button>
        </nav>

        <div className="right">
          <span
            className="status"
            aria-live="polite"
            title={STATUS_TEXT[activeTab.conn]}
          >
            <span
              className="dot"
              style={{
                background: STATUS_COLOR[activeTab.conn],
                boxShadow: `0 0 8px ${STATUS_COLOR[activeTab.conn]}`,
              }}
            />
            <span className="status-text">{STATUS_TEXT[activeTab.conn]}</span>
          </span>
          <button
            className="ai-btn"
            onClick={() => setAiOpen(true)}
            aria-label="打开 Claude 任务面板"
          >
            <span className="ai-emoji">🤖</span>
            <span className="ai-label">Claude</span>
          </button>
        </div>
      </header>

      <main className="term-wrap">
        <div className="term-card">
          {tabs.map((t) => {
            const isActive = t.id === activeTab.id;
            return (
              <div
                key={t.id}
                className="term-slot"
                style={{ display: isActive ? "flex" : "none" }}
              >
                <TerminalPane
                  active={isActive}
                  onConnChange={(c) => handleConnChange(t.id, c)}
                />
              </div>
            );
          })}
        </div>
      </main>

      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />

      <style jsx>{`
        .app {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(
              1200px 600px at 10% -10%,
              rgba(127, 221, 202, 0.08),
              transparent 60%
            ),
            radial-gradient(
              900px 500px at 110% 0%,
              rgba(130, 170, 255, 0.08),
              transparent 60%
            ),
            #0b0f17;
          color: #d6deeb;
          padding-top: env(safe-area-inset-top);
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
          padding-bottom: env(safe-area-inset-bottom);
        }

        .topbar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.04),
            rgba(255, 255, 255, 0)
          );
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          min-width: 0;
        }
        .logo {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: conic-gradient(
            from 180deg,
            #7fdbca,
            #82aaff,
            #c792ea,
            #7fdbca
          );
          box-shadow: 0 0 12px rgba(127, 221, 202, 0.55);
          flex: 0 0 auto;
        }
        .title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.3px;
          background: linear-gradient(135deg, #d6deeb 0%, #7fdbca 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          white-space: nowrap;
        }

        .tabs {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 0 4px;
        }
        .tabs::-webkit-scrollbar {
          display: none;
        }

        .tab {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 0 8px 0 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 12px;
          color: rgba(214, 222, 235, 0.78);
          cursor: pointer;
          user-select: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
          max-width: 160px;
        }
        .tab:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }
        .tab.active {
          background: rgba(127, 221, 202, 0.1);
          border-color: rgba(127, 221, 202, 0.35);
          color: #e7f5f1;
        }
        .tab-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .tab-label {
          flex: 0 1 auto;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tab-close {
          appearance: none;
          background: transparent;
          border: 0;
          color: rgba(214, 222, 235, 0.55);
          font-size: 14px;
          line-height: 1;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tab-close:hover {
          background: rgba(239, 68, 68, 0.18);
          color: #ef4444;
        }
        .tab-add {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.16);
          color: rgba(214, 222, 235, 0.7);
          width: 28px;
          height: 28px;
          border-radius: 8px;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .tab-add:hover {
          background: rgba(127, 221, 202, 0.1);
          border-color: rgba(127, 221, 202, 0.35);
          color: #b8e6dc;
        }

        .right {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-text {
          color: rgba(214, 222, 235, 0.8);
        }

        .ai-btn {
          appearance: none;
          border: 0;
          color: #0b0f17;
          background: linear-gradient(135deg, #7fdbca 0%, #82aaff 100%);
          font-weight: 600;
          font-size: 12.5px;
          padding: 7px 12px;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease,
            box-shadow 0.2s ease;
          box-shadow: 0 4px 14px rgba(127, 221, 202, 0.25);
        }
        .ai-btn:hover {
          box-shadow: 0 6px 20px rgba(127, 221, 202, 0.4);
        }
        .ai-btn:active {
          transform: scale(0.96);
        }

        .term-wrap {
          flex: 1 1 auto;
          min-height: 0;
          padding: 10px;
          display: flex;
        }
        .term-card {
          flex: 1 1 auto;
          min-height: 0;
          border-radius: 12px;
          background: #0b0f17;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.35),
            inset 0 0 0 1px rgba(255, 255, 255, 0.02);
          overflow: hidden;
          padding: 8px;
          display: flex;
          position: relative;
        }
        .term-slot {
          flex: 1 1 auto;
          min-height: 0;
          width: 100%;
          height: 100%;
        }

        @media (max-width: 640px) {
          .topbar {
            gap: 6px;
            padding: 6px 8px;
          }
          .title {
            display: none;
          }
          .status-text {
            display: none;
          }
          .status {
            padding: 4px 6px;
          }
          .ai-btn {
            padding: 6px 10px;
            font-size: 12px;
          }
          .ai-label {
            display: none;
          }
          .tab {
            max-width: 120px;
          }
        }

        @media (max-height: 420px) {
          .topbar {
            padding: 4px 8px;
          }
        }
      `}</style>
    </div>
  );
}
