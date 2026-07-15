"use client";

import { useState, useTransition } from "react";
import { sendGenreNotification } from "./actions";

/**
 * ジャンルボタン（手動通知）
 *
 * ボタンを押すと、そのジャンルの最新記事をSlackに送る（サーバーアクション経由）。
 * モバイルでも押しやすいよう大きめのボタンにし、送信中・結果を各ボタンに表示する。
 */
type Genre = { name: string; emoji: string; count: number };

export function GenreButtons({ genres }: { genres: Genre[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  function handleClick(name: string) {
    setActiveGenre(name);
    setResults((prev) => ({ ...prev, [name]: "送信中…" }));
    startTransition(async () => {
      const result = await sendGenreNotification(name);
      setResults((prev) => ({
        ...prev,
        [name]: result.ok
          ? result.count > 0
            ? `送信しました（${result.count}件）`
            : "記事がありませんでした"
          : `失敗：${result.error ?? "エラー"}`,
      }));
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {genres.map((genre) => {
        const busy = isPending && activeGenre === genre.name;
        return (
          <button
            key={genre.name}
            type="button"
            onClick={() => handleClick(genre.name)}
            disabled={isPending}
            className="flex flex-col items-start rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 disabled:opacity-50"
          >
            <span className="text-base font-semibold">
              {genre.emoji} {genre.name}
            </span>
            <span className="mt-1 text-xs text-slate-500">{genre.count} 件</span>
            {results[genre.name] && (
              <span className="mt-2 text-xs text-blue-600">
                {busy ? "送信中…" : results[genre.name]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
