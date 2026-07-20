import { put } from "@vercel/blob";

/**
 * ブリーフィングの音声化（Gemini TTS）
 *
 * 通勤中に聞けるよう、ブリーフィング本文を読み上げた音声ファイルを作って Blob に保存する。
 * 音声ファイル（URL）にしておくと、画面を消しても再生が続き、ロック画面から操作できる
 * （ブラウザの読み上げAPIは画面を消すと止まるため、この方式にしている）。
 *
 * 仕組み:
 *   Gemini TTS は生の PCM（24kHz・16bit・モノラル）を返すため、
 *   ブラウザが再生できるよう WAV ヘッダーを付けてから保存する。
 *
 * フェイルセーフ：GEMINI_API_KEY 未設定・API失敗でも例外を投げず、理由を返すだけ。
 */

const TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

/** 読み上げの声（Geminiのプリセット。落ち着いた声を選択） */
const TTS_VOICE = "Kore";

/** Gemini TTS の出力仕様（WAVヘッダーを作るのに必要） */
const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/** 読み上げに渡す最大文字数（長すぎる場合は切る。ブリーフィングは2000字以内の想定） */
const MAX_INPUT_CHARS = 4_000;

export type TtsResult = { ok: boolean; url?: string; error?: string };

export function isTtsConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * テキストを読み上げた音声を作り、Blobに保存してURLを返す。
 * @param text 読み上げる本文（Markdownは事前にプレーン化しておくこと）
 * @param pathname 保存先のファイル名（例: briefing/2026-07-17.wav）
 */
export async function synthesizeToBlob(text: string, pathname: string): Promise<TtsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY が未設定です" };
  }

  const input = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!input) return { ok: false, error: "読み上げる本文がありません" };

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        // 読み方の指示もプロンプトとして渡せる（落ち着いたニュース読み上げ）
        input: `落ち着いたトーンで、ニュース番組のように読み上げてください:\n\n${input}`,
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: TTS_VOICE }] },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[TTS] 失敗 (HTTP ${response.status}): ${body.slice(0, 300)}`);
      return { ok: false, error: `音声生成に失敗しました (HTTP ${response.status})` };
    }

    const audio = extractAudio(await response.json());
    if (!audio) return { ok: false, error: "音声データが返りませんでした" };

    // 生PCM → WAV（ブラウザで再生できる形式）に変換
    const pcm = Buffer.from(audio.base64, "base64");
    const wav = pcmToWav(pcm, audio.rate);

    // ストアはPrivate運用（会議の録音と同じ）。再生時に署名付きURLを発行して使う。
    // 同じ日付なら上書きしたいので addRandomSuffix は使わない。
    const blob = await put(pathname, wav, {
      access: "private",
      contentType: "audio/wav",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return { ok: true, url: blob.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[TTS] エラー:", message);
    return { ok: false, error: `音声生成に失敗しました: ${message}` };
  }
}

/**
 * レスポンスから音声データ（base64）とサンプルレートを取り出す。
 *
 * Geminiのレスポンス形式は
 *   steps[].content[] に { mime_type: "audio/l16;rate=24000", data: "<base64>" }
 * が入る形。将来 output_audio 形式に変わっても拾えるよう両対応にしている。
 */
function extractAudio(payload: unknown): { base64: string; rate: number } | null {
  const data = payload as {
    output_audio?: { data?: string };
    steps?: { content?: { mime_type?: string; data?: string }[] }[];
  };

  if (typeof data?.output_audio?.data === "string") {
    return { base64: data.output_audio.data, rate: SAMPLE_RATE };
  }

  for (const step of data?.steps ?? []) {
    for (const content of step?.content ?? []) {
      if (typeof content?.data === "string" && content.mime_type?.startsWith("audio/")) {
        // mime_type に rate=24000 のように書かれていればそれを使う
        const matched = content.mime_type.match(/rate=(\d+)/);
        return { base64: content.data, rate: matched ? Number(matched[1]) : SAMPLE_RATE };
      }
    }
  }
  return null;
}

/**
 * 生PCMデータにWAVヘッダー（44バイト）を付ける。
 * Gemini TTSは 16bit・モノラルのリニアPCM（既定24kHz）を返す。
 */
function pcmToWav(pcm: Buffer, sampleRate: number = SAMPLE_RATE): Buffer {
  const byteRate = (sampleRate * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0); // ChunkID
  header.writeUInt32LE(36 + pcm.length, 4); // ChunkSize
  header.write("WAVE", 8); // Format
  header.write("fmt ", 12); // Subchunk1ID
  header.writeUInt32LE(16, 16); // Subchunk1Size（PCMは16）
  header.writeUInt16LE(1, 20); // AudioFormat（1=リニアPCM）
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write("data", 36); // Subchunk2ID
  header.writeUInt32LE(pcm.length, 40); // Subchunk2Size

  return Buffer.concat([header, pcm]);
}

/**
 * Markdownを読み上げ用のプレーンテキストにする。
 * 記号をそのまま読ませないため、見出し・箇条書き・強調などを落とす。
 */
export function markdownToSpeechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "") // コードブロックは読まない
    .replace(/^#{1,6}\s*/gm, "") // 見出し記号
    .replace(/^\s*[-*+]\s+/gm, "") // 箇条書き記号
    .replace(/^\s*\d+\.\s+/gm, "") // 番号付き箇条書き
    .replace(/\*\*(.+?)\*\*/g, "$1") // 太字
    .replace(/\*(.+?)\*/g, "$1") // 斜体
    .replace(/`(.+?)`/g, "$1") // インラインコード
    .replace(/\[(.+?)\]\(.*?\)/g, "$1") // リンクはテキストだけ
    .replace(/^\s*\|.*\|\s*$/gm, "") // 表の行は読まない
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
