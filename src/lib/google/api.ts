import type { GoogleAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { refreshAccessToken } from "./oauth";

/**
 * Google APIアクセスの共通処理（アクセストークン管理つき）
 *
 * - アクセストークンはプロセス内メモリにキャッシュし、期限が切れたらrefresh_tokenで更新する
 * - refresh_tokenが失効していたら、アカウントを status="expired"（要再連携）に更新して null を返す
 *   → 呼び出し側は「取得できなかった」として扱い、他のアカウント・他のカードは生かす（フェイルセーフ）
 */

// アカウントID → アクセストークン（Vercelのサーバーレスでもインスタンス再利用中は効く）
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** 有効なアクセストークンを返す。再連携が必要なら null */
export async function getAccessToken(account: GoogleAccount): Promise<string | null> {
  const cached = tokenCache.get(account.id);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token; // 期限まで1分以上あるものだけ使う
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(account.refreshTokenEnc);
  } catch (error) {
    console.error(`[Google連携] トークンの復号に失敗（${account.email}）:`, error);
    return null; // TOKEN_ENCRYPTION_KEY未設定・鍵変更など
  }

  const result = await refreshAccessToken(refreshToken);
  if ("expired" in result) {
    // refresh_token失効 → 要再連携としてマークする（画面に「再連携」ボタンが出る）
    console.warn(`[Google連携] refresh_tokenが失効しています（${account.email}）`);
    tokenCache.delete(account.id);
    await prisma.googleAccount
      .update({ where: { id: account.id }, data: { status: "expired" } })
      .catch(() => {});
    return null;
  }

  tokenCache.set(account.id, {
    token: result.accessToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
  });

  // 失効から復帰していたら active に戻す
  if (account.status !== "active") {
    await prisma.googleAccount
      .update({ where: { id: account.id }, data: { status: "active" } })
      .catch(() => {});
  }

  return result.accessToken;
}

/**
 * 認証付きでGoogle APIを叩いてJSONを返す。失敗時は null（呼び出し側でフェイルセーフに扱う）。
 * 401が返ったらトークンキャッシュを捨てて1回だけリトライする。
 */
export async function googleApiGetJson<T>(
  account: GoogleAccount,
  url: string,
  retried = false,
): Promise<T | null> {
  const token = await getAccessToken(account);
  if (!token) return null;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401 && !retried) {
    tokenCache.delete(account.id); // トークンが早期失効した場合。更新してもう一度だけ
    return googleApiGetJson<T>(account, url, true);
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[Google API] ${res.status} ${account.email} ${url.split("?")[0]}: ${body.slice(0, 200)}`,
    );
    return null;
  }
  return (await res.json()) as T;
}

/** 連携済みアカウント一覧（作成順）。DB障害時は空配列 */
export async function listGoogleAccounts(): Promise<GoogleAccount[]> {
  try {
    return await prisma.googleAccount.findMany({ orderBy: { createdAt: "asc" } });
  } catch (error) {
    console.error("[Google連携] アカウント一覧の取得に失敗:", error);
    return [];
  }
}
