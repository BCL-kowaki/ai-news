import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * アプリ本体のログイン設定（NextAuth）
 *
 * - Googleアカウントでサインインし、ALLOWED_EMAIL に載っているメールだけを許可する
 * - セッションはJWT（DB不要）。Cookieの暗号化キーは NEXTAUTH_SECRET
 * - フェイルセーフ：環境変数が未設定なら誰もログインできない（＝アプリは開かない）
 *
 * ※ ここは「アプリに入るための認証」。GmailやカレンダーのAPI連携（フェーズ2）は
 *    別途 GoogleAccount テーブル＋自前OAuthフローで管理し、この設定とは分離する。
 */

/** ログインを許可するメールアドレス一覧（ALLOWED_EMAIL。カンマ区切りで複数可） */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** ログインに必要な環境変数がすべて設定されているか */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.NEXTAUTH_SECRET &&
      allowedEmails().length > 0,
  );
}

/** 未設定の環境変数名の一覧（ログイン画面のセットアップ案内に使う。値は絶対に返さない） */
export function missingAuthEnvKeys(): string[] {
  const keys: [string, boolean][] = [
    ["GOOGLE_CLIENT_ID", Boolean(process.env.GOOGLE_CLIENT_ID)],
    ["GOOGLE_CLIENT_SECRET", Boolean(process.env.GOOGLE_CLIENT_SECRET)],
    ["NEXTAUTH_SECRET", Boolean(process.env.NEXTAUTH_SECRET)],
    ["ALLOWED_EMAIL", allowedEmails().length > 0],
  ];
  return keys.filter(([, ok]) => !ok).map(([name]) => name);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // ガード節：設定不備・許可リスト外のメールはすべて拒否（フェイルセーフ）
    async signIn({ user }) {
      if (!isAuthConfigured()) return false;
      const email = user.email?.toLowerCase();
      return Boolean(email && allowedEmails().includes(email));
    },
  },
};
