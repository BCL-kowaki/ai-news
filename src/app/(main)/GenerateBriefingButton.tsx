"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";

/** ブリーフィングの「今すぐ生成／更新」ボタン（ダッシュボード用） */
export function GenerateBriefingButton({ hasBriefing }: { hasBriefing: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(json.error ?? "生成に失敗しました。");
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={running}
        className={hasBriefing ? "btn-ghost" : "btn-primary"}
      >
        {hasBriefing ? (
          <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
        {running ? "生成中…（30秒ほど）" : hasBriefing ? "更新" : "今すぐ生成"}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
