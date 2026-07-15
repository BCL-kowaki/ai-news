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
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/" className="text-sm font-bold text-accent hover:underline">
        ← ダッシュボードに戻る
      </Link>
      <h1 className="mt-4 text-3xl font-black" style={{ fontWeight: 950 }}>
        媒体一覧
      </h1>
      <p className="mt-1 text-sm text-muted">
        登録されている情報元（RSSソース）です。媒体名を押すとフィードを開きます。
      </p>

      {sources === null ? (
        <p className="panel mt-8 p-4 text-sm text-accent">DBに接続できませんでした。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-line bg-panel">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line text-left text-muted">
                <th className="px-3 py-3 font-bold">媒体</th>
                <th className="px-3 py-3 font-bold">ジャンル</th>
                <th className="px-3 py-3 font-bold">記事数</th>
                <th className="px-3 py-3 font-bold">状態</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b border-line/25">
                  <td className="px-3 py-3">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block min-w-[180px] max-w-[320px] font-bold text-ink underline-offset-2 hover:underline"
                    >
                      {source.name}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {source.category ?? "―"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {source.articleCount} 件
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {source.active ? (
                      <span className="font-bold text-accent">収集中</span>
                    ) : (
                      <span className="text-muted">停止</span>
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
