import { issueSignedToken, presignUrl } from "@vercel/blob";

/**
 * Vercel Blob（Privateストア）の音声を読むための署名付きURL発行
 *
 * 会議の録音は機密性が高いため、ストアはPrivate（URLだけでは誰も読めない）にしている。
 * 再生・文字起こしのときだけ、ここで有効期限つきの署名URLを発行して使う。
 *
 * フェイルセーフ：発行に失敗した場合（Publicストア運用・トークン未設定など）は
 * 元のURLをそのまま返す（Publicストアなら元URLで再生できる）。
 */

const BLOB_HOST_PATTERN = /\.blob\.vercel-storage\.com$/;

/** 音声の再生・取得に使える一時URLを返す（既定1時間有効） */
export async function getReadableAudioUrl(
  blobUrl: string,
  expiresInSec = 3600,
): Promise<string> {
  try {
    const url = new URL(blobUrl);
    if (!BLOB_HOST_PATTERN.test(url.hostname)) return blobUrl; // Blob以外はそのまま

    const pathname = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const validUntil = Date.now() + expiresInSec * 1000;

    // 読み取り専用・このファイル限定・期限つきの署名を発行
    const token = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "get",
      pathname,
      access: "private",
      validUntil,
    });
    return presignedUrl;
  } catch (error) {
    // Publicストア運用や設定不備の場合は元URLで動かす（壊さない）
    console.warn("[Blob] 署名付きURLの発行に失敗（元URLで続行）:", error);
    return blobUrl;
  }
}
