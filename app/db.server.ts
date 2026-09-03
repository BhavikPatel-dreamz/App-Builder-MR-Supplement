import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

//test
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const PRISMA_DELEGATES = ["session", "page", "media", "shopSettings"] as const;

function isStalePrismaClient(client: PrismaClient): boolean {
  return PRISMA_DELEGATES.some((name) => !(name in client));
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({
    connectionString,
    // Match Prisma 6's 5s acquire timeout; node-pg defaults to waiting forever.
    connectionTimeoutMillis: 5000,
  });

  return new PrismaClient({ adapter });
}

function resolvePrismaClient(): PrismaClient {
  const cached = global.prismaGlobal;

  if (cached && !isStalePrismaClient(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    global.prismaGlobal = client;

    if (import.meta.hot) {
      import.meta.hot.dispose(async () => {
        await global.prismaGlobal?.$disconnect();
        global.prismaGlobal = undefined;
      });
    }
  }

  return client;
}

const prisma = resolvePrismaClient();

export default prisma;
