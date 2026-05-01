"use client";

import { useState } from "react";
import { login } from "./api";

interface Props {
  onSuccess: () => void;
}

export default function LoginPane({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error ?? "登录失败");
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0b0f17",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16, width: "min(320px, 90vw)" }}
      >
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "conic-gradient(from 180deg, #7fdbca, #82aaff, #c792ea, #7fdbca)",
            boxShadow: "0 0 16px rgba(127,221,202,0.6)",
            marginBottom: 12,
          }} />
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            background: "linear-gradient(135deg, #d6deeb 0%, #7fdbca 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Mobile Dev Control
          </div>
        </div>

        <input
          type="password"
          placeholder="访问密码"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "12px 14px",
            color: "#d6deeb",
            fontSize: 15,
            outline: "none",
            WebkitAppearance: "none",
          }}
        />

        {error && (
          <div style={{ color: "#ef5350", fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            background: "linear-gradient(135deg, #7fdbca 0%, #82aaff 100%)",
            border: 0,
            borderRadius: 10,
            padding: "12px",
            color: "#0b0f17",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading || !password ? "not-allowed" : "pointer",
            opacity: !password ? 0.5 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          {loading ? "验证中…" : "进入终端"}
        </button>
      </form>
    </div>
  );
}
