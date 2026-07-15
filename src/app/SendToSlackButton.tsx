"use client";

import { useState, useTransition } from "react";
import { sendGenreNotification } from "./actions";

/**
 * 「このジャンルをSlackに送る」ボタン（ジャンル一覧ページに置く）
 *
 * 押すと、そのジャンルの最新記事をSlackに送る（サーバーアクション経由）。
 * 秘密情報はブラウザに出ない。Slackは無料なので何回押してもよい。
 */
export function SendToSlackButton({ category }: { category: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleClick() {
    setMessage("送信中…");
    startTransition(async () => {
      const result = await sendGenreNotification(category);
      setMessage(
        result.ok
          ? result.count > 0
            ? `送信しました（${result.count}件）`
            : "送る記事がありませんでした"
          : `失敗：${result.error ?? "エラー"}`,
      );
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-solid">
        このジャンルをSlackに送る
      </button>
      {message && <span className="text-xs font-bold text-accent">{message}</span>}
    </div>
  );
}
