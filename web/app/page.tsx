"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { getToken, clearToken } from "../components/api";
import LoginPane from "../components/LoginPane";

const Workspace = dynamic(() => import("../components/Workspace"), {
  ssr: false,
});

export default function Page() {
  // null = hydration 中，避免 SSR/CSR 不一致闪烁
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  const handleUnauthorized = () => {
    clearToken();
    setAuthed(false);
  };

  if (authed === null) return null;

  if (!authed) return <LoginPane onSuccess={() => setAuthed(true)} />;

  return <Workspace onUnauthorized={handleUnauthorized} />;
}
