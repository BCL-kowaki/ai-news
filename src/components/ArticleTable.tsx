"use client";

import { useState, useTransition } from "react";
import { summarizeArticle, translateArticle } from "@/app/actions";

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

        <div className="flex shrink-0 gap-2">
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
