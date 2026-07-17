import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { generateMeetingReport } from "@/lib/meeting-report";

/**
 * 会議レポートの生成（POST /api/meetings/[id]/summarize）
 * 文字起こし済みの会議に対して、Claude HaikuでMarkdownレポートを作る。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  if (!meeting.transcript) {
    return NextResponse.json(
      { ok: false, error: "先に文字起こしを実行してください" },
      { status: 400 },
    );
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "summarizing", errorMsg: null },
  });

  const result = await generateMeetingReport(meeting.title, meeting.transcript);

  if (!result.ok) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "transcribed", errorMsg: result.text },
    });
    return NextResponse.json({ ok: false, error: result.text }, { status: 500 });
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "done", summaryMd: result.text, errorMsg: null },
  });
  return NextResponse.json({ ok: true });
}
