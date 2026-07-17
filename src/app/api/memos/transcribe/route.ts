import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getReadableAudioUrl } from "@/lib/blob";
import { transcribeAudio } from "@/lib/transcribe";

/**
 * メモの録音の文字起こし（POST /api/memos/transcribe）
 *
 * ブラウザで録音→Blobへアップロード済みの音声URLを受け取り、
 * Geminiで文字起こししたテキストを返す。結果はメモ本文に挿入される。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** BlobのURL以外は受け付けない（外部URLの読み込み防止） */
const BLOB_URL_PATTERN = /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//;

export async function POST(request: Request) {
  // ガード節：ログイン必須（ミドルウェアとの二重防御）
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    audioUrl?: string;
    mime?: string;
  } | null;
  if (!body?.audioUrl || !BLOB_URL_PATTERN.test(body.audioUrl)) {
    return NextResponse.json({ error: "音声URLが不正です" }, { status: 400 });
  }

  const readableUrl = await getReadableAudioUrl(body.audioUrl, 1800);
  const result = await transcribeAudio(readableUrl, body.mime ?? "audio/webm");

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, text: result.text });
}
