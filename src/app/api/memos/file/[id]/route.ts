import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { getReadableAudioUrl } from "@/lib/blob";

/**
 * メモ添付ファイルの中継ルート（要ログイン）
 *
 * なぜ必要か:
 *   添付の実体はPrivate Blobにあり、読むには署名付きURL（1時間で失効）が必要。
 *   ところがメモ本文に画像を埋め込む Markdown（`![name](...)`) は本文に**URLを保存する**ため、
 *   署名付きURLを直接書くと1時間後に全部リンク切れになる。
 *   そこで本文には失効しないこのルートのURLを書き、開かれた瞬間に署名を発行して転送する。
 *
 * 安全性:
 *   ミドルウェアの保護対象内（/api/memos は除外していない）だが、
 *   多層防御としてここでもセッションを確認する。
 *   署名付きURLは短命なので、転送結果をキャッシュさせない。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  // ガード節：ログインしていない相手には添付を渡さない
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const attachment = await prisma.memoAttachment
    .findUnique({ where: { id: params.id }, select: { url: true } })
    .catch(() => null);
  if (!attachment) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const signedUrl = await getReadableAudioUrl(attachment.url);

  // 302で実体へ転送。署名は短命なのでブラウザにもCDNにも覚えさせない
  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
