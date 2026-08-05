import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { resolve } from "path";

// Prisma CLI does not auto-load .env — load it explicitly.
config({ path: resolve(__dirname, ".env.local") });
config({ path: resolve(__dirname, ".env") });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});