/**
 * タイトルの日本語訳（DeepL API 無料版）
 *
 * 英語など日本語以外のタイトルだけを日本語に訳す。
 * フェイルセーフ設計：
 *   - DEEPL_API_KEY が未設定なら翻訳しない（原文をそのまま使う）
 *   - API呼び出しが失敗しても例外を投げず null を返す（原文にフォールバック）
 * これにより、翻訳が使えない状況でも配信自体は必ず動く。
 *
 * 無料版のエンドポイントは api-free.deepl.com（有料版とはホストが違う点に注意）。
 */

const DEEPL_ENDPOINT = "https://api-free.deepl.com/v2/translate";

/** DeepLは1リクエストで最大50件までまとめて翻訳できる。 */
const DEEPL_BATCH_SIZE = 50;

/**
 * タイトルが「翻訳の必要あり（＝日本語を含まない）」かどうか。
 * ひらがな・カタカナ・漢字のいずれも含まなければ、外国語とみなして翻訳対象にする。
 */
export function needsTranslation(title: string): boolean {
  // ひらがな(3040-309F)・カタカナ(30A0-30FF)・漢字(4E00-9FFF)・半角カナ(FF66-FF9F)
  const japanese = /[぀-ヿ一-鿿ｦ-ﾟ]/;
  return !japanese.test(title);
}

/**
 * 複数タイトルをまとめて日本語に訳す。
 * 入力と同じ長さの配列を返す。訳せなかった要素は null（呼び出し側で原文にフォールバック）。
 */
export async function translateTitlesToJa(titles: string[]): Promise<(string | null)[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey || titles.length === 0) {
    return titles.map(() => null);
  }

  const results: (string | null)[] = [];
  for (let i = 0; i < titles.length; i += DEEPL_BATCH_SIZE) {
    const batch = titles.slice(i, i + DEEPL_BATCH_SIZE);
    results.push(...(await translateBatch(batch, apiKey)));
  }
  return results;
}

/**
 * 1つの文章（記事本文の抜粋など）を日本語に訳す。
 * 訳せなかった場合は null（呼び出し側で「翻訳できませんでした」等を表示）。
 */
export async function translateOneToJa(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  const [result] = await translateTitlesToJa([text]);
  return result;
}

async function translateBatch(batch: string[], apiKey: string): Promise<(string | null)[]> {
  try {
    const response = await fetch(DEEPL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: batch,
        target_lang: "JA",
        // 原文の言語は自動判定に任せる（英語以外の外国語ソースも訳せるように）
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[翻訳] DeepL失敗 (HTTP ${response.status}): ${body.slice(0, 200)}`);
      return batch.map(() => null);
    }

    const data = (await response.json()) as { translations?: { text: string }[] };
    const translations = data.translations ?? [];
    // 念のため件数がずれた場合は、足りない分を null で埋める
    return batch.map((_, idx) => translations[idx]?.text ?? null);
  } catch (error) {
    console.error("[翻訳] DeepL呼び出しでエラー:", error instanceof Error ? error.message : error);
    return batch.map(() => null);
  }
}
