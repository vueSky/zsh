"use client";

import { useCallback, useRef, useState } from "react";

interface DirShortcut {
  id: string;
  name: string;
  path: string;
}

const STORAGE_KEY = "mdc_dir_shortcuts";

const DEFAULTS: DirShortcut[] = [
  { id: "home",      name: "~",         path: "~" },
  { id: "desktop",   name: "Desktop",   path: "~/Desktop" },
  { id: "downloads", name: "Downloads", path: "~/Downloads" },
  { id: "documents", name: "Documents", path: "~/Documents" },
];

function load(): DirShortcut[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DirShortcut[]) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function persist(list: DirShortcut[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface Props {
  /** 点击快捷键时回调，调用方向终端注入命令 */
  onNavigate: (path: string) => void;
}

export default function DirShortcuts({ onNavigate }: Props) {
  const [shortcuts, setShortcuts] = useState<DirShortcut[]>(load);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPath, setAddPath] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (path: string) => {
      // \x15 = Ctrl+U，清空当前行输入，再 cd
      onNavigate(`\x15cd ${path}\r`);
    },
    [onNavigate],
  );

  const remove = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const openAdd = useCallback(() => {
    setAddOpen(true);
    setAddName("");
    setAddPath("");
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  const confirmAdd = useCallback(() => {
    const name = addName.trim();
    const path = addPath.trim();
    if (!name || !path) return;
    const next: DirShortcut = {
      id: `sc_${Date.now()}`,
      name,
      path,
    };
    setShortcuts((prev) => {
      const list = [...prev, next];
      persist(list);
      return list;
    });
    setAddOpen(false);
  }, [addName, addPath]);

  const cancelAdd = useCallback(() => {
    setAddOpen(false);
  }, []);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") confirmAdd();
      if (e.key === "Escape") cancelAdd();
    },
    [confirmAdd, cancelAdd],
  );

  return (
    <div className="dir-bar">
      {/* 添加表单（展开态） */}
      {addOpen && (
        <div className="add-form" role="dialog" aria-label="添加目录快捷键">
          <input
            ref={nameRef}
            className="add-input add-input-name"
            placeholder="名称"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <input
            className="add-input add-input-path"
            placeholder="路径，如 ~/Documents/GitHub/Hades"
            value={addPath}
            onChange={(e) => setAddPath(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <button
            className="add-action add-confirm"
            type="button"
            onClick={confirmAdd}
            disabled={!addName.trim() || !addPath.trim()}
            aria-label="确认"
          >
            ✓
          </button>
          <button
            className="add-action add-cancel"
            type="button"
            onClick={cancelAdd}
            aria-label="取消"
          >
            ✕
          </button>
        </div>
      )}

      {/* 快捷键横向列表 */}
      <div className="chip-row" role="toolbar" aria-label="目录快捷键">
        {/* 编辑模式切换 */}
        <button
          className={`ctrl-btn ${editing ? "ctrl-active" : ""}`}
          type="button"
          onClick={() => setEditing((v) => !v)}
          title={editing ? "完成编辑" : "编辑快捷键"}
          aria-pressed={editing}
        >
          {editing ? "完成" : "编辑"}
        </button>

        <div className="divider" />

        {/* 目录 chips */}
        {shortcuts.map((s) => (
          <div key={s.id} className="chip-wrap">
            <button
              className="chip"
              type="button"
              onClick={() => !editing && navigate(s.path)}
              title={s.path}
              aria-label={`切换到 ${s.path}`}
            >
              <span className="chip-icon">📁</span>
              <span className="chip-name">{s.name}</span>
            </button>
            {editing && (
              <button
                className="chip-del"
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`删除 ${s.name}`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* 添加按钮 */}
        <button
          className="add-btn"
          type="button"
          onClick={openAdd}
          title="添加目录快捷键"
          aria-label="添加目录快捷键"
        >
          +
        </button>
      </div>

      <style jsx>{`
        .dir-bar {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          background: rgba(8, 11, 18, 0.9);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: env(safe-area-inset-bottom);
        }

        /* ── 添加表单 ── */
        .add-form {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(127, 221, 202, 0.04);
          border-bottom: 1px solid rgba(127, 221, 202, 0.1);
          animation: slide-down 0.15s ease;
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .add-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 5px 8px;
          color: #d6deeb;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .add-input:focus {
          border-color: rgba(127, 221, 202, 0.45);
        }
        .add-input-name { width: 72px; flex: 0 0 auto; }
        .add-input-path { flex: 1 1 auto; min-width: 0; }
        .add-action {
          appearance: none;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 0;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          transition: opacity 0.15s ease;
        }
        .add-confirm {
          background: rgba(34, 218, 110, 0.2);
          color: #22da6e;
        }
        .add-confirm:hover:not(:disabled) { background: rgba(34, 218, 110, 0.3); }
        .add-confirm:disabled { opacity: 0.35; cursor: not-allowed; }
        .add-cancel {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(214, 222, 235, 0.7);
        }
        .add-cancel:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

        /* ── chip 行 ── */
        .chip-row {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .chip-row::-webkit-scrollbar { display: none; }

        .ctrl-btn {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(214, 222, 235, 0.55);
          font-size: 11px;
          padding: 3px 9px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          flex: 0 0 auto;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .ctrl-btn:hover {
          color: rgba(214, 222, 235, 0.9);
          background: rgba(255, 255, 255, 0.07);
        }
        .ctrl-active {
          background: rgba(127, 221, 202, 0.1);
          border-color: rgba(127, 221, 202, 0.3);
          color: #7fdbca;
        }

        .divider {
          width: 1px;
          height: 18px;
          background: rgba(255, 255, 255, 0.07);
          flex: 0 0 auto;
          margin: 0 2px;
        }

        /* ── 单个 chip ── */
        .chip-wrap {
          position: relative;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
        }
        .chip {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          padding: 4px 10px 4px 7px;
          color: rgba(214, 222, 235, 0.8);
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .chip:active {
          background: rgba(127, 221, 202, 0.12);
          border-color: rgba(127, 221, 202, 0.35);
          color: #c8ede8;
          transform: scale(0.96);
        }
        .chip:hover:not(:active) {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .chip-icon { font-size: 13px; line-height: 1; }
        .chip-name { font-size: 12px; }

        .chip-del {
          appearance: none;
          position: absolute;
          top: -5px;
          right: -5px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 0;
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pop-in 0.15s ease;
          z-index: 1;
        }
        @keyframes pop-in {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
        .chip-del:hover { background: #c0392b; }

        /* ── 添加按钮 ── */
        .add-btn {
          appearance: none;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          width: 28px;
          height: 28px;
          color: rgba(214, 222, 235, 0.5);
          font-size: 16px;
          cursor: pointer;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          margin-left: 2px;
        }
        .add-btn:hover {
          background: rgba(127, 221, 202, 0.08);
          border-color: rgba(127, 221, 202, 0.3);
          color: #7fdbca;
        }

        @media (max-height: 420px) {
          .dir-bar { display: none; }
        }
      `}</style>
    </div>
  );
}
