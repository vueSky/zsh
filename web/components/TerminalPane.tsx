"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { TOKEN, buildServerUrls } from "./api";

export type ConnState = "connecting" | "open" | "closed" | "error";

interface Props {
  // 当组件被切换到非激活态时，仍保留 DOM；激活时调用 refit
  active: boolean;
  onConnChange?: (state: ConnState) => void;
}

export default function TerminalPane({ active, onConnChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    let ws: WebSocket | null = null;
    let ro: ResizeObserver | null = null;
    let rafId = 0;
    disposedRef.current = false;

    const safeFit = () => {
      const t = termRef.current;
      const f = fitRef.current;
      if (disposedRef.current || !t || !f) return;
      if (host.clientWidth <= 0 || host.clientHeight <= 0) return;
      try {
        f.fit();
      } catch {
        /* xterm 内部状态未就绪 */
      }
    };

    const init = () => {
      if (disposedRef.current) return;
      if (host.clientWidth <= 0 || host.clientHeight <= 0) {
        rafId = requestAnimationFrame(init);
        return;
      }

      const term = new Terminal({
        fontSize: isMobile ? 12 : 14,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        cursorBlink: true,
        cursorStyle: "bar",
        scrollback: 5000,
        allowProposedApi: true,
        theme: {
          background: "#0b0f17",
          foreground: "#d6deeb",
          cursor: "#7fdbca",
          cursorAccent: "#0b0f17",
          selectionBackground: "rgba(127,221,202,0.3)",
          black: "#011627",
          red: "#ef5350",
          green: "#22da6e",
          yellow: "#addb67",
          blue: "#82aaff",
          magenta: "#c792ea",
          cyan: "#21c7a8",
          white: "#ffffff",
          brightBlack: "#637777",
          brightRed: "#ef5350",
          brightGreen: "#22da6e",
          brightYellow: "#ffeb95",
          brightBlue: "#82aaff",
          brightMagenta: "#c792ea",
          brightCyan: "#7fdbca",
          brightWhite: "#ffffff",
        },
      });
      termRef.current = term;

      const fit = new FitAddon();
      fitRef.current = fit;
      term.loadAddon(fit);
      term.open(host);
      requestAnimationFrame(safeFit);

      const { wsBase } = buildServerUrls();
      ws = new WebSocket(`${wsBase}?token=${TOKEN}`);

      ws.onopen = () => {
        if (!disposedRef.current) onConnChange?.("open");
      };
      ws.onmessage = (event) => {
        if (disposedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "output") term.write(msg.data);
        } catch {
          /* ignore malformed payload */
        }
      };
      ws.onerror = () => {
        if (!disposedRef.current) onConnChange?.("error");
      };
      ws.onclose = () => {
        if (!disposedRef.current) onConnChange?.("closed");
      };

      term.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      ro = new ResizeObserver(safeFit);
      ro.observe(host);
      window.addEventListener("resize", safeFit);
      window.addEventListener("orientationchange", safeFit);

      term.focus();
    };

    onConnChange?.("connecting");
    init();

    return () => {
      disposedRef.current = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", safeFit);
      window.removeEventListener("orientationchange", safeFit);
      try {
        ro?.disconnect();
      } catch {}
      try {
        ws?.close();
      } catch {}
      try {
        termRef.current?.dispose();
      } catch {}
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 tab 回来时容器尺寸变化，重新 fit + 聚焦
  useEffect(() => {
    if (!active) return;
    const t = termRef.current;
    const f = fitRef.current;
    const host = hostRef.current;
    if (!t || !f || !host) return;
    const id = requestAnimationFrame(() => {
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        try {
          f.fit();
        } catch {}
        t.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  // 注意：内联尺寸样式是必须的 —— xterm 容器必须有非零尺寸才会触发 init
  return (
    <div
      ref={hostRef}
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
