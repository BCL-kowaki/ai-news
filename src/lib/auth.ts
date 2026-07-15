import { timingSafeEqual } from "node:crypto";

/**
 * Cronエンドポイントの認証
 *
 * フェイルセーフ設計：CRON_SECRET が未設定なら「常に拒否」する。
 * （未設定時に素通りさせると、URLを知っている誰でもSlack配信や収集を勝手に発火できてしまうため）
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[認証] CRON_SECRET が未設定のため、リクエストを拒否しました");
    return false;
  }

  const header = request.headers.get("authorization");
  if (!header) return false;

  const expected = `Bearer ${secret}`;
  return safeCompare(header, expected);
}

/** 文字列比較（実行時間の差から秘密情報を推測されないよう、定数時間で比較する）。 */
function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
