/**
 * Google OAuth（連携用・自前フロー）
 *
 * アプリへのログイン（NextAuth）とは別に、Gmail・カレンダーのAPIアクセス権を
 * 複数のGoogleアカウント（会社用・個人用）から個別に取得するためのフロー。
 * ここでは「認可URLの生成」「コード→トークン交換」「アクセストークンの更新」だけを担当し、
 * DB保存やセッション確認は呼び出し側（route handler）が行う。
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * 連携で要求するスコープ。
 * Gmailは読み取り専用。カレンダーは閲覧＋予定の作成（会議機能の自動登録に使用）。
 * ※ calendar.events を後から追加したため、既存の連携アカウントは「再連携」で権限を追加する必要がある。
 */
export const GOOGLE_CONNECT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events", // 会議の予定を書き込む
  "https://www.googleapis.com/auth/gmail.readonly",
];

/** OAuthクライアントの設定が揃っているか */
export function isGoogleClientConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** コールバックURL。NEXTAUTH_URL（アプリの公開URL）を基準に組み立てる */
export function getRedirectUri(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("NEXTAUTH_URL が未設定です");
  return `${base}/api/google/callback`;
}

/** Googleの同意画面へ飛ばす認可URLを作る */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CONNECT_SCOPES.join(" "),
    access_type: "offline", // refresh_tokenをもらうために必須
    prompt: "consent", // 再連携時にも必ずrefresh_tokenを再発行させる
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // 秒
  scope: string;
};

/** 認可コードをトークンに交換する */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`トークン交換に失敗しました（${res.status}）: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * refresh_tokenでアクセストークンを更新する。
 * refresh_tokenが失効している場合（テストモードの7日失効・ユーザーによる取り消し）は
 * { expired: true } を返す。呼び出し側はアカウントを「要再連携」にする。
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number } | { expired: true }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    // invalid_grant = refresh_tokenが無効（失効・取り消し）。再連携が必要
    if (body.includes("invalid_grant")) return { expired: true };
    throw new Error(`アクセストークンの更新に失敗しました（${res.status}）: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** アクセストークンから連携したアカウントのメールアドレスを取得する */
export async function fetchAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ユーザー情報の取得に失敗しました（${res.status}）`);
  }
  const json = (await res.json()) as { email?: string };
  if (!json.email) throw new Error("メールアドレスを取得できませんでした");
  return json.email;
}
