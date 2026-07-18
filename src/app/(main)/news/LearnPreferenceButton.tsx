"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { learnPreference } from "@/app/actions";

/**
 * 「好みを学習」ボタン
 * お気に入りの傾向をAIが読み取り、おすすめ判定のキーワードを更新する。
 */
export function LearnPreferenceButton({ hasPreference }: { hasPreference: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function learn() {
    setRunning(true);
    setMessage(null);
    const res = await learnPreference();
    setMessage(res.message);
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={learn} disabled={running} className="btn-ghost">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {running ? "学習中…" : hasPreference ? "好みを再学習" : "好みを学習"}
      </button>
      {message && <span className="text-xs font-bold text-muted">{message}</span>}
    </div>
  );
}
