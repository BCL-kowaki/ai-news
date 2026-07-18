"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markArticlesRead } from "@/app/actions";

/**
 * 表示中の記事をまとめて既読にするボタン
 * 削除ではないので、あとから「既読」タブで見返せる。
 */
export function MarkAllReadButton({ articleIds }: { articleIds: string[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  if (articleIds.length === 0) return null;

  async function markAll() {
    setRunning(true);
    await markArticlesRead(articleIds);
    setRunning(false);
    router.refresh();
  }

  return (
    <button type="button" onClick={markAll} disabled={running} className="btn-ghost">
      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {running ? "処理中…" : `表示中の${articleIds.length}件を既読に`}
    </button>
  );
}
