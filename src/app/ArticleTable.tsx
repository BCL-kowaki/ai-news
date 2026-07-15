"use client";

import { useState, useTransition } from "react";
import { summarizeArticle, translateArticle } from "./actions";

/**
 * ジャンル別の記事一覧（レスポンシブ）
 *
 * - PC（sm以上）: 表のように列が横並び（#・タイトル・情報元・日時・操作）
 * - スマホ: 横スクロールせず、各項目を縦に積むカード表示（画面幅に収まる）
 *
 * 「翻訳」「要約」ボタンを押すと、その記事だけをオンデマンド処理し、結果を下に表示する。
 * 本文抜粋が無い記事はボタンを無効化する。
 */
export type ArticleRow = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedLabel: string;
  hasContent: boolean;
};

type ResultState = { kind: "translate" | "summarize"; ok: boolean; text: string } | null;

export function ArticleTable({ articles }: { articles: ArticleRow[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border-2 border-line bg-panel">
      {/* PC用の見出し行（スマホでは非表示） */}
      <div className="hidden items-center gap-4 border-b-2 border-line px-4 py-3 text-sm font-bold text-muted sm:flex">
        <div className="w-7 shrink-0">#</div>
        <div className="flex-1">タイトル</div>
        <div className="w-40 shrink-0">情報元</div>
        <div className="w-24 shrink-0">日時</div>
        <div className="w-[140px] shrink-0">操作</div>
      </div>
      <ul>
        {articles.map((article, index) => (
          <ArticleItem key={article.id} article={article} index={index} />
        ))}
      </ul>
    </div>
  );
}

function ArticleItem({ article, index }: { article: ArticleRow; index: number }) {
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
    <li className="border-b border-line/25 px-4 py-3 last:border-b-0">
      {/* スマホ: 縦積み(flex-col) / PC: 横並び(flex-row) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="hidden w-7 shrink-0 font-bold text-muted sm:block">{index + 1}</div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 font-medium text-ink underline-offset-2 hover:underline"
        >
          {article.title}
        </a>

        {/* スマホ: 情報元・日時を1行に横並び / PC: contents で各列に展開 */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted sm:contents sm:text-sm">
          <span className="sm:w-40 sm:shrink-0">{article.sourceName}</span>
          <span className="sm:w-24 sm:shrink-0">{article.publishedLabel}</span>
        </div>

        <div className="flex w-[140px] shrink-0 gap-2">
          <button
            type="button"
            onClick={() => run("translate")}
            disabled={isPending || !article.hasContent}
            title={article.hasContent ? "本文を日本語に翻訳" : "本文の抜粋がありません"}
            className="btn-outline"
          >
            翻訳
          </button>
          <button
            type="button"
            onClick={() => run("summarize")}
            disabled={isPending || !article.hasContent}
            title={article.hasContent ? "AIで要約" : "本文の抜粋がありません"}
            className="btn-outline"
          >
            要約
          </button>
        </div>
      </div>

      {(isPending && active !== null) || result ? (
        <div className="mt-2 rounded-lg border border-line/30 bg-paper px-3 py-2">
          {isPending ? (
            <span className="text-xs font-bold text-muted">
              {active === "translate" ? "翻訳中…" : "要約中…"}
            </span>
          ) : result ? (
            <div>
              <div className="text-xs font-black text-accent">
                {result.kind === "translate" ? "翻訳" : "要約"}
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                  result.ok ? "text-ink" : "text-accent"
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
