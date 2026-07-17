import crypto from "crypto";

/**
 * トークン暗号化ユーティリティ（AES-256-GCM）
 *
 * Google連携の refresh_token をDBに保存する前に必ずここで暗号化する。
 * 鍵は環境変数 TOKEN_ENCRYPTION_KEY（`openssl rand -hex 32` で生成した64文字の16進数）。
 * フェイルセーフ：鍵が未設定なら暗号化も復号もできない＝連携機能が動かない側に倒れる。
 */

const ALGORITHM = "aes-256-gcm";
const KEY_PATTERN = /^[0-9a-f]{64}$/i; // 32バイト（256bit）の16進表現

/** 暗号化鍵が正しく設定されているか（設定画面の状態表示にも使う） */
export function isEncryptionConfigured(): boolean {
  return KEY_PATTERN.test(process.env.TOKEN_ENCRYPTION_KEY ?? "");
}

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (!KEY_PATTERN.test(hex)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY が未設定または形式不正です（openssl rand -hex 32 で生成した64文字を設定してください）",
    );
  }
  return Buffer.from(hex, "hex");
}

/** 平文を暗号化して「iv.認証タグ.暗号文」のbase64連結文字列で返す */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12); // GCM推奨の96bit IV。毎回ランダム
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

/** encryptSecret の逆変換。改ざんされていれば例外になる（GCMの認証付き復号） */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("暗号化データの形式が不正です");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
