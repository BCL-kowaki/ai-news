import Link from "next/link";
import { CATEGORIES } from "@/lib/config";
import { getMonthKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

/**
 * 稼働状況ページ（自分用のダッシュボード）
 *
 * - 記事の収集・配信が回っているかの確認
 * - 「登録ソース」カード → 媒体一覧ページ（/sources）へ
 * - ジャンルカード → そのジャンルの記事一覧ページ（/genre/[ジャンル]）へ
 */

export const dynamic = "force-dynamic"; // 毎回DBを見て最新の数字を出す

export default async function Page() {
  const stats = await loadStats();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">AIニュース配信システム（Slack）</h1>
      <p className="mt-2 text-sm text-slate-600">
        稼働状況（{stats ? "DB接続 OK" : "DBに接続できません"}）
      </p>

      {stats ? (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4">
            <Stat label="未送信の記事" value={`${stats.pending} 件`} />
            <Stat label="送信済みの記事" value={`${stats.sent} 件`} />
            <Stat label="今月の配信回数" value={`${stats.monthlyBroadcasts} 回`} />
            {/* 登録ソースは押すと媒体一覧へ遷移 */}
            <Stat
              label="登録ソース"
              value={`${stats.sources} 件`}
              href="/sources"
              hint="媒体一覧を見る →"
            />
            <Stat
              label="最終配信"
              value={stats.lastSentAt ? formatJst(stats.lastSentAt) : "まだなし"}
            />
            <Stat label="集計月" value={stats.monthKey} />
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">ジャンル別の記事一覧</h2>
            <p className="mt-1 text-xs text-slate-500">
              カードを押すと、そのジャンルの記事一覧を表示します（そこからSlackにも送れます）。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.genres.map((genre) => (
                <Link
                  key={genre.name}
                  href={`/genre/${encodeURIComponent(genre.name)}`}
                  className="flex flex-col items-start rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400"
                >
                  <span className="text-base font-semibold">
                    {genre.emoji} {genre.name}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">{genre.count} 件</span>
                </Link>
              ))}
            </div>
          </section>

          <p className="mt-10 text-xs text-slate-400">
            収集: 毎時 / 配信: 1日3回（日本時間 8・13・19時）
          </p>
        </>
      ) : (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          DATABASE_URL が正しく設定されているか確認してください。
        </p>
      )}
    </main>
  );
}

/** 統計カード。href を渡すとリンク（クリックで遷移）になる。 */
function Stat({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
      {hint && <span className="mt-1 block text-xs text-blue-600">{hint}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border border-slate-200 bg-white p-4">{body}</div>;
}

function formatJst(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadStats() {
  const monthKey = getMonthKey();
  try {
    const [pending, sent, sources, monthlyBroadcasts, lastLog, genreCounts] = await Promise.all([
      prisma.article.count({ where: { status: "pending" } }),
      prisma.article.count({ where: { status: "sent" } }),
      prisma.source.count({ where: { active: true } }),
      prisma.sendLog.count({ where: { monthKey } }),
      prisma.sendLog.findFirst({ orderBy: { sentAt: "desc" } }),
      Promise.all(
        CATEGORIES.map(async (c) => ({
          name: c.name,
          emoji: c.emoji,
          count: await prisma.article.count({
            where: { status: { in: ["pending", "sent"] }, source: { category: c.name } },
          }),
        })),
      ),
    ]);
    return {
      monthKey,
      pending,
      sent,
      sources,
      monthlyBroadcasts,
      lastSentAt: lastLog?.sentAt ?? null,
      genres: genreCounts,
    };
  } catch (error) {
    console.error("[画面] DBの統計取得に失敗しました:", error);
    return null;
  }
}
