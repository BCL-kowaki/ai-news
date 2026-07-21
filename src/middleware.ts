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
 * - /share     … 会議レポートの共有リンク（社外メンバー向け。下記の注意を参照）
 * - /icon, /apple-icon … favicon・ホーム画面アイコン（Next.jsは拡張子なしのURLで配信する）
 * - /_next, ドットを含むパス … ビルド資産・画像・マニフェスト等の静的ファイル
 *
 * 【/share を除外している理由と安全性】
 * ログインしていない相手に会議レポートを渡すための限定公開ページ。
 * - 表示するのは `Meeting.summaryMd`（レポート本文）だけ。音声・文字起こしは返さない
 * - アクセスできるのは、DBに保存された推測不能なトークンと完全一致したときだけ
 * - 共有をOFFにすると（トークンをnullに）リンクは即座に無効になる
 * - noindex を付けて検索エンジンに載らないようにしている
 * ※ この行を消すと共有リンクが開けなくなり、広げすぎると他ページが無防備になる。変更時は要注意
 */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|login|share|icon|apple-icon|_next|.*\\..*).*)"],
};
