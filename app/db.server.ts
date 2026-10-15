import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

//test
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const PRISMA_DELEGATES = [
  "session",
  "page",
  "media",
  "shopSettings",
  "pushNotification",
] as const;

function isStalePrismaClient(client: PrismaClient): boolean {
  return PRISMA_DELEGATES.some((name) => !(name in client));
}

function postgresConnectionString(url: string): string {
  // node-pg currently treats require/prefer/verify-ca as verify-full and warns.
  // Keep today's behavior by making that explicit.
  return url.replace(
    /([?&]sslmode=)(require|prefer|verify-ca)\b/gi,
    "$1verify-full",
  );
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({
    connectionString: postgresConnectionString(connectionString),
    // One connection per Vercel instance. Neon’s pooler does the multiplexing.
    // 5s is shorter than a Neon cold start, so login dies with
    // "Connection terminated due to connection timeout" before Session is read.
    max: 1,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
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
