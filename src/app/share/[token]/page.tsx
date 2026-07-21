import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

/**
 * 会議レポートの共有ページ（/share/[token]）— ログイン不要
 *
 * ログインしていないメンバーにレポートだけを見せるための限定公開ページ。
 * ミドルウェアの認証から除外している唯一のアプリ画面なので、次の原則を必ず守る:
 *
 *   1. 出すのは `summaryMd`（レポート本文）とタイトル・日時だけ
 *      → 音声(audioUrl)・文字起こし(transcript)は絶対に取得も表示もしない
 *   2. トークンが完全一致する会議のみ。共有OFF（token=null）の会議は開けない
 *   3. 他の会議やアプリ内部への導線は置かない（一覧・ログインへのリンクを出さない）
 *   4. 検索エンジンに載せない（noindex）
 */

export const dynamic = "force-dynamic";

/** 検索エンジンに載せない（限定公開のため） */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({
  params,
}: {
  params: { token: string };
}) {
  const meeting = await loadSharedReport(params.token);
  if (!meeting) notFound();

  return (
    <div className="min-h-dvh bg-bg px-5 py-10 sm:py-14">
      <main className="mx-auto max-w-3xl">
        <div className="card p-6 sm:p-8">
          <p className="text-[13px] font-bold text-muted">会議レポート</p>
          <h1 className="large-title mt-1">{meeting.title}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {formatJstDateTime(meeting.recordedAt)}
          </p>

          <div className="report mt-6 border-t-2 border-line pt-5">
            <Markdown remarkPlugins={[remarkGfm]}>{meeting.summaryMd}</Markdown>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          このページは共有リンクを知っている人だけが閲覧できます。
        </p>
      </main>
    </div>
  );
}

/**
 * トークンから共有中のレポートを取る。
 * select で「公開してよい列」だけを明示的に指定する（音声・文字起こしは取らない）。
 */
async function loadSharedReport(token: string) {
  // 空文字や異常に長い値でDBを叩かない
  if (!token || token.length > 100) return null;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { shareToken: token },
      select: { title: true, recordedAt: true, summaryMd: true },
    });
    // レポートが無い場合は公開しない
    if (!meeting?.summaryMd) return null;
    return { ...meeting, summaryMd: meeting.summaryMd };
  } catch (error) {
    console.error("[共有レポート] 取得失敗:", error);
    return null;
  }
}
