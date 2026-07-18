"use client";

import { useState, useTransition } from "react";
import { Check, Star, Undo2 } from "lucide-react";
import {
  summarizeArticle,
  toggleFavoriteArticle,
  toggleReadArticle,
  translateArticle,
} from "@/app/actions";

/**
 * 記事一覧（レスポンシブ）
 *
 * - PC（sm以上）: 表のように列が横並び（タイトル・情報元・日時・操作）
 * - スマホ: 各項目を縦に積むカード表示（横スクロールさせない）
 *
 * 「翻訳」「要約」ボタンを押すと、その記事だけをオンデマンド処理し、結果を下に表示する。
 * 本文抜粋が無い記事はボタンを無効化する。
 */
export type ArticleRow = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  category: string | null;
  categoryStyle: { bg: string; fg: string };
  publishedLabel: string;
  hasContent: boolean;
  favorite: boolean;
  read: boolean;
};

type ResultState = { kind: "translate" | "summarize"; ok: boolean; text: string } | null;

export function ArticleTable({ articles }: { articles: ArticleRow[] }) {
  return (
    <div className="card mt-4 overflow-hidden">
      <ul className="divide-y divide-line">
        {articles.map((article) => (
          <ArticleItem key={article.id} article={article} />
        ))}
      </ul>
    </div>
  );
}

function ArticleItem({ article }: { article: ArticleRow }) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<"translate" | "summarize" | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [favorite, setFavorite] = useState(article.favorite);
  const [hidden, setHidden] = useState(false); // 既読にした直後は一覧から即座に隠す

  /** お気に入りの切り替え（表示は即時反映＝楽観更新、サーバー結果で最終確定） */
  function toggleFavorite() {
    setFavorite((prev) => !prev);
    startTransition(async () => {
      const res = await toggleFavoriteArticle(article.id);
      setFavorite(res.favorite);
    });
  }

  /**
   * 既読／未読の切り替え。
   * 未読一覧で既読にしたら隠す（削除ではないので「既読」タブから見返せる）。
   * 既読一覧で未読に戻した場合も同様に、その一覧からは消える。
   */
  function toggleRead() {
    setHidden(true);
    startTransition(async () => {
      await toggleReadArticle(article.id);
    });
  }

  if (hidden) return null;

  function run(kind: "translate" | "summarize") {
    setActive(kind);
    setResult(null);
    startTransition(async () => {
      const res =
        kind === "translate"
          ? await translateArticle(article.id)
          : await summarizeArticle(article.id);
      setResult({ kind, ok: res.ok, text: res.text });
    });
  }

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium leading-relaxed text-ink underline-offset-2 hover:underline"
          >
            {article.title}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {article.category && (
              <span
                className="chip"
                style={{
                  backgroundColor: article.categoryStyle.bg,
                  color: article.categoryStyle.fg,
                }}
              >
                {article.category}
              </span>
            )}
            <span>{article.sourceName}</span>
            <span className="text-faint">{article.publishedLabel}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* お気に入り（★） */}
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
            aria-pressed={favorite}
            className="-m-1 cursor-pointer p-1 transition-transform duration-150 active:scale-90"
          >
            <Star
              className={`h-5 w-5 ${favorite ? "text-[#DF923F]" : "text-faint hover:text-muted"}`}
              fill={favorite ? "#DF923F" : "none"}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => run("translate")}
            disabled={isPending || !article.hasContent}
            title={article.hasContent ? "本文を日本語に翻訳" : "本文の抜粋がありません"}
            className="btn-ghost"
          >
            翻訳
          </button>
          <button
            type="button"
            onClick={() => run("summarize")}
            disabled={isPending || !article.hasContent}
            title={article.hasContent ? "AIで要約" : "本文の抜粋がありません"}
            className="btn-ghost"
          >
            要約
          </button>
          {/* 既読／未読の切り替え（削除ではないので「既読」タブから見返せる） */}
          <button
            type="button"
            onClick={toggleRead}
            disabled={isPending}
            aria-label={article.read ? "未読に戻す" : "既読にする"}
            title={article.read ? "未読に戻す" : "読み終わった（一覧から隠す）"}
            className="-m-1 cursor-pointer p-1 text-faint transition-colors duration-150 hover:text-accent disabled:cursor-default disabled:opacity-30"
          >
            {article.read ? (
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {(isPending && active !== null) || result ? (
        <div className="mt-2.5 rounded-xl bg-bg px-3.5 py-2.5">
          {isPending ? (
            <span className="text-xs font-semibold text-muted">
              {active === "translate" ? "翻訳中…" : "要約中…"}
            </span>
          ) : result ? (
            <div>
              <div className="text-xs font-bold text-accent">
                {result.kind === "translate" ? "翻訳" : "要約"}
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                  result.ok ? "text-ink" : "text-red-600"
                }`}
              >
                {result.text}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
