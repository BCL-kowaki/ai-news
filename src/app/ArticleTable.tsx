"use client";

import { useState, useTransition } from "react";
import { summarizeArticle, translateArticle } from "./actions";

/**
 * ジャンル別の記事一覧テーブル（クライアント側）
 *
 * 各行にタイトル（元記事リンク）・情報元・日時を表示。
 * 「翻訳」「要約」ボタンを押すと、その記事だけをオンデマンド処理し、結果を行の下に表示する。
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
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="w-8 py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">タイトル</th>
            <th className="py-2 pr-4 font-medium">情報元</th>
            <th className="py-2 pr-4 font-medium">日時</th>
            <th className="py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article, index) => (
            <ArticleRowView key={article.id} article={article} index={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleRowView({ article, index }: { article: ArticleRow; index: number }) {
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
    <>
      <tr className="border-b border-slate-100 align-top">
        <td className="py-2 pr-2 text-slate-400">{index + 1}</td>
        <td className="py-2 pr-4">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {article.title}
          </a>
        </td>
        <td className="py-2 pr-4 whitespace-nowrap text-slate-600">{article.sourceName}</td>
        <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{article.publishedLabel}</td>
        <td className="py-2 whitespace-nowrap">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run("translate")}
              disabled={isPending || !article.hasContent}
              title={article.hasContent ? "本文を日本語に翻訳" : "本文の抜粋がありません"}
              className="rounded border border-slate-300 px-2 py-1 text-xs transition hover:border-slate-500 disabled:opacity-40"
            >
              翻訳
            </button>
            <button
              type="button"
              onClick={() => run("summarize")}
              disabled={isPending || !article.hasContent}
              title={article.hasContent ? "AIで要約" : "本文の抜粋がありません"}
              className="rounded border border-slate-300 px-2 py-1 text-xs transition hover:border-slate-500 disabled:opacity-40"
            >
              要約
            </button>
          </div>
        </td>
      </tr>
      {(isPending && active !== null) || result ? (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td />
          <td colSpan={4} className="py-2 pr-4">
            {isPending ? (
              <span className="text-xs text-slate-500">
                {active === "translate" ? "翻訳中…" : "要約中…"}
              </span>
            ) : result ? (
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  {result.kind === "translate" ? "翻訳" : "要約"}
                </div>
                <p
                  className={`mt-1 whitespace-pre-wrap text-sm ${
                    result.ok ? "text-slate-800" : "text-red-600"
                  }`}
                >
                  {result.text}
                </p>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
