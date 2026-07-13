import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;

function createPrisma(): PrismaClient {
  // Prisma v7 requires a non-undefined options argument — passing {} lets the
  // runtime resolve the datasource URL from prisma.config.ts and DATABASE_URL.
  return new PrismaClient({});
}

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = globalForPrisma.prisma ?? createPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = _prisma;
  return _prisma;
}
