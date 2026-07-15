import { PrismaClient } from "@prisma/client";

/**
 * Prismaクライアント（DB接続の入口）
 *
 * 開発中はNext.jsがコードを再読み込みするたびに接続が増えてしまうため、
 * グローバルに1個だけ保持して使い回す（DB接続の枯渇を防ぐ定番パターン）。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
