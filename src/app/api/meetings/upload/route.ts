import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";

/**
 * 会議音声のアップロード窓口（Vercel Blobのクライアントアップロード用トークン発行）
 *
 * Vercelのサーバーレスはリクエスト4.5MB制限があるため、音声本体はブラウザから
 * Blobストレージへ直接アップロードする。このルートはその「許可証」を発行するだけ。
 * ログイン中のユーザーにしか発行しない。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 許可する音声形式（録音=webm/mp4、取り込み=一般的な音声ファイル） */
const ALLOWED_CONTENT_TYPES = [
  "audio/webm",
  "video/webm", // Chromeの録音はこのMIMEになることがある
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
  "audio/ogg",
];

/** アップロード上限（約3時間の録音を想定） */
const MAX_SIZE_BYTES = 300 * 1024 * 1024;

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
      // アップロード完了通知（本番のみ届く）。DB登録はクライアント経由のServer Actionで行うため何もしない
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[会議アップロード] 失敗:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
