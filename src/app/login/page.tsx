import Image from "next/image";
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
        {/* SERAワードマーク（白地ロゴ。カードも白なのでそのまま馴染む） */}
        <Image
          src="/logo-wordmark.png"
          alt="SERA — AI Secretary Agent"
          width={880}
          height={330}
          priority
          className="mx-auto h-14 w-auto mix-blend-multiply"
        />
        <p className="mt-3 text-sm text-muted">
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
