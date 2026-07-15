import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * 媒体一覧ページ（/sources）
 *
 * 登録されているRSSソース（媒体）を表形式で一覧する。
 * ダッシュボードの「登録ソース」カードから遷移してくる。
 */

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await loadSources();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← ダッシュボードに戻る
      </Link>
      <h1 className="mt-4 text-2xl font-bold">媒体一覧</h1>
      <p className="mt-1 text-sm text-slate-600">
        登録されている情報元（RSSソース）です。媒体名を押すとフィードを開きます。
      </p>

      {sources === null ? (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          DBに接続できませんでした。
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">媒体</th>
                <th className="py-2 pr-4 font-medium">ジャンル</th>
                <th className="py-2 pr-4 font-medium">記事数</th>
                <th className="py-2 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {source.name}
                    </a>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{source.category ?? "―"}</td>
                  <td className="py-2 pr-4 text-slate-600">{source.articleCount} 件</td>
                  <td className="py-2">
                    {source.active ? (
                      <span className="text-green-600">収集中</span>
                    ) : (
                      <span className="text-slate-400">停止</span>
                    )}
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

async function loadSources() {
  try {
    const sources = await prisma.source.findMany({
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
      include: { _count: { select: { articles: true } } },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      category: s.category,
      active: s.active,
      articleCount: s._count.articles,
    }));
  } catch (error) {
    console.error("[媒体一覧] 取得失敗:", error);
    return null;
  }
}
