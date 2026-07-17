import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";

/**
 * メモ添付ファイルのアップロード窓口（Vercel Blobのクライアントアップロード用トークン発行）
 *
 * 画像・動画・PDF・音声（メモの録音）を受け付ける。
 * 実体はブラウザからBlobストレージ（Private）へ直接送られ、このルートは許可証を発行するだけ。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 許可するファイル形式 */
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
];

/** アップロード上限（動画も想定して200MB） */
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request) {
  // ガード節：ログイン中のユーザー以外にはトークンを発行しない
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true, // URLを推測不能にする
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[メモ添付] アップロード失敗:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
