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
        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-line bg-panel">
          {/* PC用の見出し行（スマホでは非表示） */}
          <div className="hidden items-center gap-4 border-b-2 border-line px-4 py-3 text-sm font-bold text-muted sm:flex">
            <div className="flex-1">媒体</div>
            <div className="w-28 shrink-0">ジャンル</div>
            <div className="w-20 shrink-0">記事数</div>
            <div className="w-20 shrink-0">状態</div>
          </div>
          <ul>
            {sources.map((source) => (
              <li
                key={source.id}
                className="border-b border-line/25 px-4 py-3 last:border-b-0"
              >
                {/* スマホ: 縦積み / PC: 横並び */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-bold text-ink underline-offset-2 hover:underline"
                  >
                    {source.name}
                  </a>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted sm:contents sm:text-sm">
                    <span className="sm:w-28 sm:shrink-0">{source.category ?? "―"}</span>
                    <span className="sm:w-20 sm:shrink-0">{source.articleCount} 件</span>
                    <span className="sm:w-20 sm:shrink-0">
                      {source.active ? (
                        <span className="font-bold text-accent">収集中</span>
                      ) : (
                        <span className="text-muted">停止</span>
                      )}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
