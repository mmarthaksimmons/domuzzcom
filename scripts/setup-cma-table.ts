// One-time setup: create the cma_reports table in Neon.
// Run: npx tsx scripts/setup-cma-table.ts
import { getPrisma } from "../lib/prisma";

async function main() {
  const prisma = getPrisma();

  console.log("Creating cma_reports table...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cma_reports (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      report_data JSONB NOT NULL,
      ai_analysis TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("cma_reports table created successfully.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
