import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, isAuthConfigured, missingAuthEnvKeys } from "@/lib/nextauth";
import { LoginButton } from "./LoginButton";

/**
 * ログイン画面（唯一の認証不要ページ）
 *
 * - Googleでサインイン → 許可リスト（ALLOWED_EMAIL）のメールだけ通す
 * - 認証の環境変数が未設定なら、サインインボタンの代わりにセットアップ案内を出す
 */

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // ログイン済みならダッシュボードへ
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  const configured = isAuthConfigured();
  const missing = missingAuthEnvKeys();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          {/* 秘書アプリのシンボル（Lucide: Sparkles） */}
          <svg
            className="h-7 w-7 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">AI秘書</h1>
        <p className="mt-1 text-sm text-muted">
          あなた専用の秘書ダッシュボード
        </p>

        {configured ? (
          <>
            <LoginButton />
            {searchParams.error === "AccessDenied" && (
              <p className="mt-3 text-sm font-medium text-red-600">
                このGoogleアカウントは許可されていません。
              </p>
            )}
            {searchParams.error && searchParams.error !== "AccessDenied" && (
              <p className="mt-3 text-sm font-medium text-red-600">
                ログインに失敗しました。もう一度お試しください。
              </p>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-bg p-4 text-left">
            <p className="text-sm font-semibold">セットアップが必要です</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              以下の環境変数が未設定のため、ログインできません。
              設定方法は docs/セットアップ手順.md を参照してください。
            </p>
            <ul className="mt-2 space-y-1">
              {missing.map((key) => (
                <li key={key} className="font-mono text-xs text-red-600">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
