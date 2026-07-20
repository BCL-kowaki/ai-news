"use client";

import { useState, useTransition } from "react";
import { Bookmark, Check, Star, Undo2 } from "lucide-react";
import { NewsAudioButton } from "@/components/NewsAudioButton";
import {
  summarizeArticle,
  toggleFavoriteArticle,
  toggleReadArticle,
  toggleSaveArticle,
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
 *
 * 【片付けの考え方】
 * ★お気に入り／🔖後で見る／✓既読 のいずれかを選ぶと、その記事は受信箱（未読一覧）から
 * 隠れる（＝アーカイブ）。削除ではなく、それぞれのタブから見返せる。
 * どのタブを見ているか（view）によって、操作後に行を隠すかどうかを判断する。
 */

/** 一覧の種類。inbox=未読受信箱 / fav=お気に入り / save=後で見る / read=既読 */
export type ArticleView = "inbox" | "fav" | "save" | "read";

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
  saved: boolean;
  read: boolean;
};

type ResultState = { kind: "translate" | "summarize"; ok: boolean; text: string } | null;

export function ArticleTable({
  articles,
  view = "inbox",
}: {
  articles: ArticleRow[];
  view?: ArticleView;
}) {
  return (
    <div className="card mt-4 overflow-hidden">
      <ul className="divide-y divide-line">
        {articles.map((article) => (
          <ArticleItem key={article.id} article={article} view={view} />
        ))}
      </ul>
    </div>
  );
}

function ArticleItem({ article, view }: { article: ArticleRow; view: ArticleView }) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<"translate" | "summarize" | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [favorite, setFavorite] = useState(article.favorite);
  const [saved, setSaved] = useState(article.saved);
  const [hidden, setHidden] = useState(false); // 片付けた直後は一覧から即座に隠す

  /**
   * 操作後にこの行を今の一覧から消すべきか判定する。
   * - 受信箱（inbox）: どれか1つでも付けたら片付け完了 → 隠す
   * - 各タブ: その状態を外したら、そのタブの対象外になる → 隠す
   */
  function shouldHide(kind: ArticleView, nowOn: boolean): boolean {
    return view === "inbox" ? nowOn : view === kind ? !nowOn : false;
  }

  /** お気に入りの切り替え（表示は即時反映＝楽観更新、サーバー結果で最終確定） */
  function handleFavorite() {
    const next = !favorite;
    setFavorite(next);
    if (shouldHide("fav", next)) setHidden(true);
    startTransition(async () => {
      const res = await toggleFavoriteArticle(article.id);
      setFavorite(res.favorite);
    });
  }

  /** 「後で見る」の切り替え */
  function handleSave() {
    const next = !saved;
    setSaved(next);
    if (shouldHide("save", next)) setHidden(true);
    startTransition(async () => {
      const res = await toggleSaveArticle(article.id);
      setSaved(res.saved);
    });
  }

  /** 既読／未読の切り替え */
  function handleRead() {
    const next = !article.read;
    if (shouldHide("read", next)) setHidden(true);
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
            onClick={handleFavorite}
            aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
            aria-pressed={favorite}
            title={favorite ? "お気に入りから外す" : "お気に入り（一覧から片付ける）"}
            className="-m-1 cursor-pointer p-1 transition-transform duration-150 active:scale-90"
          >
            <Star
              className={`h-5 w-5 ${favorite ? "text-[#DF923F]" : "text-faint hover:text-muted"}`}
              fill={favorite ? "#DF923F" : "none"}
              aria-hidden="true"
            />
          </button>

          {/* 後で見る（🔖） */}
          <button
            type="button"
            onClick={handleSave}
            aria-label={saved ? "「後で見る」から外す" : "後で見る"}
            aria-pressed={saved}
            title={saved ? "「後で見る」から外す" : "後で見る（一覧から片付ける）"}
            className="-m-1 cursor-pointer p-1 transition-transform duration-150 active:scale-90"
          >
            <Bookmark
              className={`h-5 w-5 ${saved ? "text-[#709BAD]" : "text-faint hover:text-muted"}`}
              fill={saved ? "#709BAD" : "none"}
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

          {/* この記事を音声で聞く（通勤中向け） */}
          <NewsAudioButton
            scope={{ type: "article", articleId: article.id }}
            mediaTitle={article.title}
          />

          {/* 既読／未読の切り替え */}
          <button
            type="button"
            onClick={handleRead}
            disabled={isPending}
            aria-label={article.read ? "未読に戻す" : "既読にする"}
            title={article.read ? "未読に戻す" : "読み終わった（一覧から片付ける）"}
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
