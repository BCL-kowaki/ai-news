"use client";

import { useState, useTransition } from "react";
import { summarizeArticle, translateArticle } from "./actions";

/**
 * ジャンル別の記事一覧テーブル（クライアント側）
 *
 * 各行にタイトル（元記事リンク）・情報元・日時を表示。
 * 「翻訳」「要約」ボタンを押すと、その記事だけをオンデマンド処理し、結果を行の下に表示する。
 * 本文抜粋が無い記事はボタンを無効化する。
 *
 * スマホ対応: 親を横スクロールにし、各列の幅を確保する（窮屈な改行を防ぐ）。
 *   タイトル列は最大320pxで折り返す（狭く潰れない）。他の列は改行しない。
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
    <div className="mt-5 overflow-x-auto rounded-2xl border-2 border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-line text-left text-muted">
            <th className="w-10 px-3 py-3 font-bold">#</th>
            <th className="px-3 py-3 font-bold">タイトル</th>
            <th className="px-3 py-3 font-bold">情報元</th>
            <th className="px-3 py-3 font-bold">日時</th>
            <th className="px-3 py-3 font-bold">操作</th>
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
      <tr className="border-b border-line/25 align-top">
        <td className="px-3 py-3 font-bold text-muted">{index + 1}</td>
        <td className="px-3 py-3">
          {/* タイトルは240〜320pxで折り返し。狭く潰れず、広がりすぎない */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-[240px] max-w-[320px] font-medium text-ink underline-offset-2 hover:underline"
          >
            {article.title}
          </a>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-muted">{article.sourceName}</td>
        <td className="whitespace-nowrap px-3 py-3 text-muted">{article.publishedLabel}</td>
        <td className="whitespace-nowrap px-3 py-3">
          <div className="flex gap-2">
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
        </td>
      </tr>
      {(isPending && active !== null) || result ? (
        <tr className="border-b border-line/25 bg-paper">
          <td />
          <td colSpan={4} className="px-3 py-3">
            {isPending ? (
              <span className="text-xs font-bold text-muted">
                {active === "translate" ? "翻訳中…" : "要約中…"}
              </span>
            ) : result ? (
              <div className="max-w-2xl">
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
          </td>
        </tr>
      ) : null}
    </>
  );
}
