import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/transcribe";

/**
 * 会議の文字起こし実行（POST /api/meetings/[id]/transcribe）
 *
 * 長時間音声の処理に時間がかかるため、Server Actionではなく専用ルートにして
 * 実行時間の上限を広げている（maxDuration）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 長い会議の文字起こしに備える（秒）

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  // ガード節：ログイン必須（ミドルウェアとの二重防御）
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!meeting) {
    return NextResponse.json({ error: "会議が見つかりません" }, { status: 404 });
  }
  if (meeting.status === "transcribing") {
    return NextResponse.json({ error: "文字起こしを実行中です" }, { status: 409 });
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "transcribing", errorMsg: null },
  });

  const result = await transcribeAudio(meeting.audioUrl, meeting.audioMime ?? "audio/webm");

  if (!result.ok) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "error", errorMsg: result.error },
    });
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "transcribed", transcript: result.text, errorMsg: null },
  });
  return NextResponse.json({ ok: true });
}
