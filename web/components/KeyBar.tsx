"use client";

interface Props {
  onSend: (text: string) => void;
}

const KEYS = [
  { label: "Esc",  title: "Escape",          send: "\x1b" },
  { label: "Tab",  title: "Tab / 补全",       send: "\t" },
  { label: "^C",   title: "Ctrl+C 中断",      send: "\x03" },
  { label: "^D",   title: "Ctrl+D EOF",       send: "\x04" },
  { label: "^L",   title: "Ctrl+L 清屏",      send: "\x0c" },
  { label: "^Z",   title: "Ctrl+Z 挂起",      send: "\x1a" },
  { label: "^A",   title: "Ctrl+A 行首",      send: "\x01" },
  { label: "^E",   title: "Ctrl+E 行尾",      send: "\x05" },
  { label: "^U",   title: "Ctrl+U 清行",      send: "\x15" },
  { label: "^R",   title: "Ctrl+R 历史搜索",  send: "\x12" },
  { label: "^W",   title: "Ctrl+W 删词",      send: "\x17" },
  { label: "Del",  title: "Delete 向后删除",   send: "\x1b[3~" },
  { label: "Home", title: "行首",              send: "\x1b[H" },
  { label: "End",  title: "行尾",              send: "\x1b[F" },
  { label: "↑",    title: "上条历史命令",      send: "\x1b[A" },
  { label: "↓",    title: "下条历史命令",      send: "\x1b[B" },
  { label: "←",    title: "左移",             send: "\x1b[D" },
  { label: "→",    title: "右移",             send: "\x1b[C" },
];

export default function KeyBar({ onSend }: Props) {
  return (
    <div className="keybar">
      {KEYS.map((k) => (
        <button
          key={k.label}
          className="key"
          type="button"
          title={k.title}
          aria-label={k.title}
          onPointerDown={(e) => {
            e.preventDefault(); // 阻止移动端虚拟键盘弹出
            onSend(k.send);
          }}
        >
          {k.label}
        </button>
      ))}

      <style jsx>{`
        .keybar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          overflow-x: auto;
          overflow-y: hidden;
          background: rgba(6, 9, 15, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .keybar::-webkit-scrollbar { display: none; }

        .key {
          appearance: none;
          flex: 0 0 auto;
          min-width: 40px;
          height: 36px;
          padding: 0 9px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: rgba(214, 222, 235, 0.85);
          font-size: 12px;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.1s ease, transform 0.08s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .key:active {
          background: rgba(127, 221, 202, 0.15);
          border-color: rgba(127, 221, 202, 0.4);
          border-bottom-color: rgba(127, 221, 202, 0.5);
          color: #7fdbca;
          transform: translateY(1px);
        }

        @media (max-height: 420px) {
          .keybar { display: none; }
        }
      `}</style>
    </div>
  );
}
