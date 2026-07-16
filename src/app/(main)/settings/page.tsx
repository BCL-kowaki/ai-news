import { getServerSession } from "next-auth";
import { Settings, Link2, Rss, KeyRound, UserRound } from "lucide-react";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./SignOutButton";

/**
 * 設定ページ（/settings）
 *
 * - アカウント: ログイン中のユーザーとログアウト
 * - Google連携: 連携済みアカウントの一覧（フェーズ2で追加・再連携UIを実装）
 * - AI・翻訳: APIキーの設定状況（キーの値は絶対に表示しない）
 * - 情報ソース: ニュース収集元RSSの一覧
 */

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const data = await loadSettings();

  return (
    <main>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Settings className="h-5 w-5 text-accent" aria-hidden="true" />
        設定
      </h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* アカウント */}
        <section className="card p-5">
          <h2 className="card-title">
            <UserRound className="h-4 w-4 text-accent" aria-hidden="true" />
            アカウント
          </h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted">
              {session?.user?.email ?? "不明なユーザー"}
            </p>
            <SignOutButton />
          </div>
        </section>

        {/* AI・翻訳の設定状況 */}
        <section className="card p-5">
          <h2 className="card-title">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
            AI・翻訳
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <EnvStatus label="AI要約（Claude）" configured={Boolean(process.env.ANTHROPIC_API_KEY)} />
            <EnvStatus label="日本語翻訳（DeepL）" configured={Boolean(process.env.DEEPL_API_KEY)} />
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            キーはサーバーの環境変数で管理しています。この画面に値が表示されることはありません。
          </p>
        </section>

        {/* Google連携（フェーズ2） */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="card-title">
            <Link2 className="h-4 w-4 text-accent" aria-hidden="true" />
            Google連携（Gmail・カレンダー）
          </h2>
          {data === null ? (
            <p className="mt-3 text-sm text-red-600">DBに接続できませんでした。</p>
          ) : data.googleAccounts.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              まだ連携されていません。会社用・個人用のGoogleアカウントを接続すると、
              予定とメールがダッシュボードに表示されます（フェーズ2で実装予定）。
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {data.googleAccounts.map((account) => (
                <li key={account.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: account.colorHex ?? "#4F46E5" }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{account.label}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{account.email}</span>
                  {account.status === "expired" ? (
                    <span className="chip bg-red-50 text-red-600">要再連携</span>
                  ) : (
                    <span className="chip bg-green-50 text-green-700">接続中</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 情報ソース */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="card-title">
            <Rss className="h-4 w-4 text-accent" aria-hidden="true" />
            ニュースの情報ソース
          </h2>
          <p className="mt-1 text-xs text-faint">
            追加・削除はコード（src/lib/sources.ts）の編集だけでできます。DBには自動で同期されます。
          </p>
          {data === null ? (
            <p className="mt-3 text-sm text-red-600">DBに接続できませんでした。</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {data.sources.map((source) => (
                <li key={source.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline"
                  >
                    {source.name}
                  </a>
                  <span className="hidden text-xs text-muted sm:block">
                    {source.category ?? "―"}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted">
                    {source.articleCount}件
                  </span>
                  {source.active ? (
                    <span className="chip shrink-0 bg-green-50 text-green-700">収集中</span>
                  ) : (
                    <span className="chip shrink-0 bg-bg text-faint">停止</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

/** 環境変数の設定状況を丸バッジで表示する（値は扱わない） */
function EnvStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      {configured ? (
        <span className="chip bg-green-50 text-green-700">設定済み</span>
      ) : (
        <span className="chip bg-bg text-faint">未設定</span>
      )}
    </li>
  );
}

async function loadSettings() {
  try {
    const [googleAccounts, sources] = await Promise.all([
      prisma.googleAccount.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.source.findMany({
        orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
        include: { _count: { select: { articles: true } } },
      }),
    ]);
    return {
      googleAccounts,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        category: s.category,
        active: s.active,
        articleCount: s._count.articles,
      })),
    };
  } catch (error) {
    console.error("[設定] 取得失敗:", error);
    return null;
  }
}
