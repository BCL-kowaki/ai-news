import Link from "next/link";
import { notFound } from "next/navigation";
import { SendToSlackButton } from "@/app/SendToSlackButton";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * ジャンル別の記事一覧ページ（/genre/[category]）
 *
 * そのジャンルの記事を表形式で一覧する。各行を押すと元記事のページへ遷移する。
 * ページ上部の「Slackに送る」ボタンで、このジャンルの最新記事をSlackに送れる。
 */

export const dynamic = "force-dynamic";

export default async function GenrePage({ params }: { params: { category: string } }) {
  const category = decodeURIComponent(params.category);

  // 定義済みのジャンルでなければ404（任意の値でのアクセスを防ぐ）
  if (!CATEGORIES.some((c) => c.name === category)) {
    notFound();
  }

  const articles = await loadArticles(category);
  const emoji = CATEGORY_EMOJI[category] ?? "📰";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← ダッシュボードに戻る
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {emoji} {category}
          <span className="ml-2 text-base font-normal text-slate-500">
            {articles?.length ?? 0} 件
          </span>
        </h1>
        <SendToSlackButton category={category} />
      </div>

      {articles === null ? (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          DBに接続できませんでした。
        </p>
      ) : articles.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">このジャンルの記事はまだありません。</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="w-8 py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">タイトル</th>
                <th className="py-2 pr-4 font-medium">情報元</th>
                <th className="py-2 font-medium">日時</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article, index) => (
                <tr key={article.id} className="border-b border-slate-100 align-top">
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
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                    {article.sourceName}
                  </td>
                  <td className="py-2 whitespace-nowrap text-slate-500">
                    {formatJst(article.publishedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
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

async function loadArticles(category: string) {
  try {
    const articles = await prisma.article.findMany({
      where: { status: { in: ["pending", "sent"] }, source: { category } },
      orderBy: { publishedAt: "desc" },
      include: { source: { select: { name: true } } },
    });
    return articles.map((a) => ({
      id: a.id,
      // 日本語訳があれば訳を、なければ原文を表示
      title: a.titleJa ?? a.title,
      url: a.url,
      sourceName: a.source.name,
      publishedAt: a.publishedAt,
    }));
  } catch (error) {
    console.error("[ジャンル一覧] 取得失敗:", error);
    return null;
  }
}
