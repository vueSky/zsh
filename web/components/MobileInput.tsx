"use client";
import { useCallback, useRef, useState } from "react";

interface Props {
  onSend: (text: string) => void;
}

export default function MobileInput({ onSend }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(() => {
    if (!value) return;
    onSend(value + "\r");
    setValue("");
  }, [value, onSend]);

  return (
    <div className="cmd-bar">
      <input
        ref={inputRef}
        className="cmd-input"
        type="text"
        inputMode="text"
        enterKeyHint="send"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); send(); }
        }}
        placeholder="输入命令，回车执行…"
      />
      <button
        className="cmd-btn"
        type="button"
        onPointerDown={(e) => { e.preventDefault(); send(); }}
        disabled={!value}
        aria-label="执行"
        title="发送回车执行"
      >
        ↩
      </button>

      <style jsx>{`
        .cmd-bar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          background: rgba(6, 9, 15, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .cmd-input {
          flex: 1 1 auto;
          min-width: 0;
          height: 34px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0 12px;
          color: #d6deeb;
          font-size: 13px;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          outline: none;
          caret-color: #7fdbca;
          -webkit-appearance: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .cmd-input:focus {
          border-color: rgba(127, 221, 202, 0.45);
          background: rgba(255, 255, 255, 0.07);
        }
        .cmd-input::placeholder { color: rgba(214, 222, 235, 0.28); }
        .cmd-btn {
          appearance: none;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(127, 221, 202, 0.1);
          border: 1px solid rgba(127, 221, 202, 0.3);
          color: #7fdbca;
          font-size: 16px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.1s ease, opacity 0.1s ease;
        }
        .cmd-btn:not(:disabled):active {
          background: rgba(127, 221, 202, 0.22);
        }
        .cmd-btn:disabled { opacity: 0.3; cursor: default; }

        @media (max-height: 420px) {
          .cmd-bar { display: none; }
        }
      `}</style>
    </div>
  );
}
