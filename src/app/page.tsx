import Link from "next/link";
import { CATEGORIES, MANUAL_NOTIFY_COUNT } from "@/lib/config";
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
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">AI NEWS DASHBOARD</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl" style={{ fontWeight: 950 }}>
          AIニュース
        </h1>
        <p className="mt-2 text-sm text-muted">
          収集: 毎時 ／ 配信: 1日3回（日本時間 8・13・19時）・{stats ? "DB接続 OK" : "DB未接続"}
        </p>
      </header>

      {stats ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="未送信の記事" value={`${stats.pending}`} unit="件" />
            <Stat label="送信済みの記事" value={`${stats.sent}`} unit="件" />
            <Stat label="今月の配信" value={`${stats.monthlyBroadcasts}`} unit="回" />
            <Stat
              label="登録ソース"
              value={`${stats.sources}`}
              unit="件"
              href="/sources"
              hint="媒体一覧 →"
            />
            <Stat
              label="最終配信"
              value={stats.lastSentAt ? formatJst(stats.lastSentAt) : "—"}
            />
            <Stat label="集計月" value={stats.monthKey} />
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-black">ジャンル別の記事一覧</h2>
            <p className="mt-1 text-xs text-muted">
              カードを押すと記事一覧へ。そこから翻訳・要約・Slack送信（最新{MANUAL_NOTIFY_COUNT}件）ができます。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.genres.map((genre) => (
                <Link
                  key={genre.name}
                  href={`/genre/${encodeURIComponent(genre.name)}`}
                  className="panel flex flex-col gap-1 p-4 transition hover:-translate-y-0.5"
                  style={{ backgroundColor: genre.color }}
                >
                  <span className="text-base font-black">
                    {genre.emoji} {genre.name}
                  </span>
                  <span className="text-xs font-bold text-muted">{genre.count} 件</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="panel p-4 text-sm text-accent">
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
  unit,
  href,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-black">
        {value}
        {unit && <span className="ml-1 text-sm font-bold text-muted">{unit}</span>}
      </dd>
      {hint && <span className="mt-1 block text-xs font-bold text-accent">{hint}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="panel p-4 transition hover:-translate-y-0.5">
        {body}
      </Link>
    );
  }
  return <div className="panel p-4">{body}</div>;
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
          color: c.color,
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
