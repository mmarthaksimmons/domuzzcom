import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;

function createPrisma(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = globalForPrisma.prisma ?? createPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = _prisma;
  return _prisma;
}
