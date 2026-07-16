import { withAuth } from "next-auth/middleware";

/**
 * 全ページのログイン必須化（ミドルウェア）
 *
 * 未ログインのアクセスはすべて /login へリダイレクトする。
 * Gmail・カレンダーなどの個人情報を扱うため、アプリ全体を認証の内側に置く。
 *
 * matcher の除外対象（＝ログイン不要）:
 * - /api/auth  … NextAuth自身（ここを守るとログインできなくなる）
 * - /api/cron  … GitHub Actionsが叩く収集ジョブ（CRON_SECRETのBearer認証で別途保護済み）
 * - /login     … ログイン画面
 * - /icon, /apple-icon … favicon・ホーム画面アイコン（Next.jsは拡張子なしのURLで配信する）
 * - /_next, ドットを含むパス … ビルド資産・画像・マニフェスト等の静的ファイル
 */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|login|icon|apple-icon|_next|.*\\..*).*)"],
};
