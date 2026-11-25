import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const databaseUrl = process.env.DATABASE_URL;

export function getDatabase() {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Add a PostgreSQL connection string to .env.local.",
    );
  }

  if (!globalForPrisma.prisma) {
    const pool =
      globalForPrisma.prismaPool ??
      new Pool({
        connectionString: databaseUrl,
      });
    globalForPrisma.prismaPool = pool;
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    });
  }

  return globalForPrisma.prisma;
}
