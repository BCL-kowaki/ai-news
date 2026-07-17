import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCode, fetchAccountEmail } from "@/lib/google/oauth";
import { GOOGLE_ACCOUNT_COLORS } from "@/lib/config";

/**
 * Google連携のコールバック（GET /api/google/callback?code&state）
 *
 * 認可コードをトークンに交換し、refresh_tokenを暗号化してDBに保存する。
 * 同じメールアドレスなら上書き（＝再連携）。完了後は設定画面へ戻す。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ガード節：本人のセッションが無ければ何もしない
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Google側で「キャンセル」した場合など
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=denied", request.url));
  }

  // CSRF対策：開始時にCookieへ入れたstateと一致するか確認する
  const cookieStore = cookies();
  const raw = cookieStore.get("google_oauth")?.value;
  cookieStore.delete("google_oauth");
  let label = "個人";
  try {
    const parsed = JSON.parse(raw ?? "") as { state?: string; label?: string };
    if (!parsed.state || parsed.state !== state) throw new Error("state不一致");
    label = parsed.label || label;
  } catch {
    return NextResponse.redirect(new URL("/settings?error=state", request.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchAccountEmail(tokens.access_token);

    // prompt=consent なので通常はrefresh_tokenが返る。万一無ければ既存分を使い続ける
    const existing = await prisma.googleAccount.findUnique({ where: { email } });
    const refreshTokenEnc = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refreshTokenEnc;
    if (!refreshTokenEnc) {
      return NextResponse.redirect(new URL("/settings?error=norefresh", request.url));
    }

    // 色は既存を維持。新規はプリセットから未使用の色を順に割り当てる
    const colorHex =
      existing?.colorHex ??
      GOOGLE_ACCOUNT_COLORS[(await prisma.googleAccount.count()) % GOOGLE_ACCOUNT_COLORS.length];

    await prisma.googleAccount.upsert({
      where: { email },
      create: {
        email,
        label,
        refreshTokenEnc,
        scopes: tokens.scope,
        status: "active",
        colorHex,
        calendarIds: ["primary"], // まずは自分のメインカレンダーだけ表示（設定で追加選択できる）
      },
      update: {
        refreshTokenEnc,
        scopes: tokens.scope,
        status: "active",
      },
    });

    return NextResponse.redirect(
      new URL(`/settings?connected=${encodeURIComponent(email)}`, request.url),
    );
  } catch (error) {
    console.error("[Google連携] コールバック処理に失敗:", error);
    return NextResponse.redirect(new URL("/settings?error=exchange", request.url));
  }
}
