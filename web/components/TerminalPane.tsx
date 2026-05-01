"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { getToken, clearToken, buildServerUrls } from "./api";

export type ConnState = "connecting" | "open" | "closed" | "error";

export interface TerminalPaneHandle {
  /** 向终端注入任意文本（等价于用户键入） */
  sendInput: (text: string) => void;
}

interface Props {
  active: boolean;
  onConnChange?: (state: ConnState) => void;
  onUnauthorized?: () => void;
}

const RECONNECT_DELAY_MS = 3000;
const RECONNECT_MAX = 10;

const TerminalPane = forwardRef<TerminalPaneHandle, Props>(
  function TerminalPane({ active, onConnChange, onUnauthorized }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const termRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);   // 组件级 ref，供 sendInput 访问
    const disposedRef = useRef(false);

    // 对外暴露：向当前 WebSocket 连接注入输入
    useImperativeHandle(ref, () => ({
      sendInput: (text: string) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data: text }));
        }
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      let rafId = 0;
      let reconnectTimer = 0;
      let reconnectCount = 0;
      let fitTimerId = 0;
      let termReady = false;
      disposedRef.current = false;

      const safeFit = () => {
        if (!termReady || disposedRef.current) return;
        const t = termRef.current;
        const f = fitRef.current;
        if (!t || !f || !t.element) return;
        if (host.clientWidth <= 0 || host.clientHeight <= 0) return;
        try {
          f.fit();
          const ws = wsRef.current;
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", data: { cols: t.cols, rows: t.rows } }));
          }
        } catch {
          // xterm 内部竞态，忽略
        }
      };

      const connect = () => {
        if (disposedRef.current) return;
        onConnChange?.("connecting");

        const token = getToken();
        const { wsBase } = buildServerUrls();
        const ws = new WebSocket(`${wsBase}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposedRef.current) return;
          reconnectCount = 0;
          onConnChange?.("open");
          const t = termRef.current;
          if (t && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", data: { cols: t.cols, rows: t.rows } }));
          }
        };

        ws.onmessage = (event) => {
          if (disposedRef.current) return;
          try {
            const msg = JSON.parse(event.data as string) as { type: string; data: string };
            if (msg.type === "output") termRef.current?.write(msg.data);
          } catch { /* ignore */ }
        };

        ws.onerror = () => {
          if (!disposedRef.current) onConnChange?.("error");
        };

        ws.onclose = (e) => {
          if (wsRef.current === ws) wsRef.current = null;
          if (disposedRef.current) return;
          if (e.code === 4001) {
            clearToken();
            onUnauthorized?.();
            return;
          }
          onConnChange?.("closed");
          if (reconnectCount < RECONNECT_MAX) {
            reconnectCount++;
            reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
          }
        };
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

        // macrotask 确保 xterm render service 完全初始化后再 fit
        fitTimerId = window.setTimeout(() => {
          termReady = true;
          safeFit();
        }, 0);

        connect();

        term.onData((data) => {
          const ws = wsRef.current;
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "input", data }));
          }
        });

        const ro = new ResizeObserver(safeFit);
        ro.observe(host);
        window.addEventListener("resize", safeFit);
        window.addEventListener("orientationchange", safeFit);

        term.focus();

        return () => {
          ro.disconnect();
          window.removeEventListener("resize", safeFit);
          window.removeEventListener("orientationchange", safeFit);
        };
      };

      const cleanup = init();

      return () => {
        disposedRef.current = true;
        termReady = false;
        if (rafId) cancelAnimationFrame(rafId);
        clearTimeout(reconnectTimer);
        clearTimeout(fitTimerId);
        cleanup?.();
        try { wsRef.current?.close(); } catch {}
        wsRef.current = null;
        try { termRef.current?.dispose(); } catch {}
        termRef.current = null;
        fitRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!active) return;
      const t = termRef.current;
      const f = fitRef.current;
      const host = hostRef.current;
      if (!t || !f || !host || !t.element) return;
      const id = requestAnimationFrame(() => {
        if (host.clientWidth > 0 && host.clientHeight > 0) {
          try { f.fit(); } catch {}
          t.focus();
        }
      });
      return () => cancelAnimationFrame(id);
    }, [active]);

    return (
      <div
        ref={hostRef}
        style={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, width: "100%", height: "100%" }}
      />
    );
  },
);

export default TerminalPane;
