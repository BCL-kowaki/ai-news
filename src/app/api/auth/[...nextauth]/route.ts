import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth";

/**
 * NextAuthのAPIエンドポイント（サインイン・コールバック・セッション取得など全部入り）
 * 設定の本体は src/lib/nextauth.ts にある。
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
