import { getMonthKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

/**
 * 稼働状況ページ（自分用のダッシュボード）
 *
 * 記事の収集・配信が回っているかを一目で確認するためのもの。
 * 記事の本文やURLは載せず、件数だけを表示する。
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
            <Stat label="登録ソース" value={`${stats.sources} 件`} />
            <Stat
              label="最終配信"
              value={stats.lastSentAt ? formatJst(stats.lastSentAt) : "まだなし"}
            />
            <Stat label="集計月" value={stats.monthKey} />
          </dl>
          <p className="mt-6 text-xs text-slate-400">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
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
    const [pending, sent, sources, monthlyBroadcasts, lastLog] = await Promise.all([
      prisma.article.count({ where: { status: "pending" } }),
      prisma.article.count({ where: { status: "sent" } }),
      prisma.source.count({ where: { active: true } }),
      prisma.sendLog.count({ where: { monthKey } }),
      prisma.sendLog.findFirst({ orderBy: { sentAt: "desc" } }),
    ]);
    return {
      monthKey,
      pending,
      sent,
      sources,
      monthlyBroadcasts,
      lastSentAt: lastLog?.sentAt ?? null,
    };
  } catch (error) {
    console.error("[画面] DBの統計取得に失敗しました:", error);
    return null;
  }
}
