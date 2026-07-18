"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** ニュースの「今すぐ取得」ボタン（RSSを即時再取得する） */
export function FetchNewsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/news/fetch", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { inserted?: number; error?: string };
      setMessage(
        res.ok
          ? json.inserted
            ? `新着${json.inserted}件を取得しました`
            : "新着はありませんでした"
          : (json.error ?? "取得に失敗しました"),
      );
    } catch {
      setMessage("通信に失敗しました。");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={fetchNow} disabled={running} className="btn-ghost">
        <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
        {running ? "取得中…" : "今すぐ取得"}
      </button>
      {message && <span className="text-xs font-bold text-muted">{message}</span>}
    </div>
  );
}
