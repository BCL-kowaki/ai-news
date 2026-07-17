import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { isEncryptionConfigured } from "@/lib/crypto";
import { buildAuthUrl, isGoogleClientConfigured } from "@/lib/google/oauth";

/**
 * Google連携の開始（GET /api/google/connect?label=会社）
 *
 * Googleの同意画面へリダイレクトする。CSRF対策として、ランダムなstateを
 * httpOnly Cookieに保存し、コールバックで照合する。ラベルもCookie側に載せる。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ガード節：ログイン中のユーザー本人以外は開始できない（ミドルウェアとの二重防御）
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ガード節：設定不備なら設定画面へ戻してエラー表示（フェイルセーフ）
  if (!isGoogleClientConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=client", request.url));
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=enckey", request.url));
  }

  const { searchParams } = new URL(request.url);
  const label = (searchParams.get("label") ?? "").trim().slice(0, 20) || "個人";

  // CSRF対策のstate。値はコールバックでCookieと照合する
  const state = crypto.randomBytes(16).toString("hex");
  cookies().set("google_oauth", JSON.stringify({ state, label }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10分で自動失効
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
