import "dotenv/config";
import { defineConfig } from "prisma/config";

// `env()` throws when DATABASE_URL is missing. CI only runs `prisma generate`,
// so keep a placeholder URL for that path; migrate/deploy still need a real one.
// Stay on Prisma ORM 7 (`prisma@7` / 7.10.0). `prisma@latest` is Prisma 8 RC
// and has no generate/migrate deploy commands.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/ci";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
