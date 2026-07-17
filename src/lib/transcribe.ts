/**
 * 音声の文字起こし（Gemini API）
 *
 * Claudeは音声を直接扱えないため、文字起こしのみGeminiを使う（要約はClaude Haiku）。
 * フェイルセーフ：GEMINI_API_KEY 未設定なら「未設定」を返すだけでアプリは壊さない。
 *
 * 送り方は音声サイズで自動で切り替える:
 * - 15MB以下 … リクエストに直接埋め込む（inline_data。速くて簡単）
 * - それ以上 … Gemini Files APIへ一旦アップロードしてから参照（長時間会議向け）
 */

// 「常に最新のFlash」を指す別名。固定名（gemini-2.5-flash等）は新規キーで使えなくなることがある
const MODEL = "gemini-flash-latest";
const BASE = "https://generativelanguage.googleapis.com";
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const TRANSCRIBE_PROMPT = `この音声は日本語の会議の録音です。内容を忠実に文字起こししてください。

ルール:
- 発言内容はそのまま書き起こす（要約しない）。「えー」「あのー」などの意味のないフィラーだけ除いてよい
- 話者が切り替わったら「話者A:」「話者B:」のように行頭に付ける（名前が分かる場合は名前で）
- 段落は話題の切れ目で分ける
- 文字起こし本文だけを出力する（前置きや説明は不要）`;

export function isTranscribeConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type TranscribeResult = { ok: true; text: string } | { ok: false; error: string };

/** 音声URL（Vercel Blob）から文字起こしする */
export async function transcribeAudio(
  audioUrl: string,
  mimeType: string,
): Promise<TranscribeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "GEMINI_API_KEY が未設定です（docs/セットアップ手順.md 参照）",
    };
  }

  try {
    // 音声を取得
    const audioRes = await fetch(audioUrl, { cache: "no-store" });
    if (!audioRes.ok) {
      return { ok: false, error: `音声ファイルを取得できませんでした（${audioRes.status}）` };
    }
    const bytes = Buffer.from(await audioRes.arrayBuffer());

    // 音声の渡し方をサイズで切り替え
    const audioPart =
      bytes.byteLength <= INLINE_LIMIT_BYTES
        ? { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }
        : { file_data: await uploadToGeminiFiles(apiKey, bytes, mimeType) };

    // 文字起こし実行
    const res = await fetch(`${BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TRANSCRIBE_PROMPT }, audioPart] }],
        generationConfig: {
          maxOutputTokens: 65536, // 長時間会議の全文に耐える上限
          thinkingConfig: { thinkingBudget: 0 }, // 文字起こしに思考は不要（速度・無料枠優先）
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[文字起こし] Gemini APIエラー:", res.status, body.slice(0, 300));
      return { ok: false, error: `文字起こしに失敗しました（Gemini ${res.status}）` };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return { ok: false, error: "文字起こし結果が空でした（音声が短すぎる/無音の可能性）" };
    }
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[文字起こし] 失敗:", message);
    return { ok: false, error: `文字起こしに失敗しました: ${message}` };
  }
}

/**
 * Gemini Files APIへ音声をアップロードして参照情報を返す（15MB超の音声用）。
 * resumableプロトコル（開始→本体送信）の2段階。ファイルは48時間で自動削除される。
 */
async function uploadToGeminiFiles(
  apiKey: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ mime_type: string; file_uri: string }> {
  // 1. アップロード開始（アップロード先URLをもらう）
  const startRes = await fetch(`${BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: `meeting-${Date.now()}` } }),
  });
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) {
    throw new Error(`Gemini Filesへのアップロード開始に失敗（${startRes.status}）`);
  }

  // 2. 本体を送って確定
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Length": String(bytes.byteLength),
    },
    body: new Uint8Array(bytes),
  });
  if (!uploadRes.ok) {
    throw new Error(`Gemini Filesへのアップロードに失敗（${uploadRes.status}）`);
  }
  const uploaded = (await uploadRes.json()) as {
    file: { name: string; uri: string; state: string };
  };

  // 3. 処理完了（ACTIVE）まで待つ（音声の解析準備。通常は数秒）
  let file = uploaded.file;
  for (let i = 0; i < 30 && file.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${BASE}/v1beta/${file.name}?key=${apiKey}`, { cache: "no-store" });
    if (poll.ok) file = (await poll.json()) as typeof file;
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini側での音声処理が完了しませんでした（state=${file.state}）`);
  }

  return { mime_type: mimeType, file_uri: file.uri };
}
