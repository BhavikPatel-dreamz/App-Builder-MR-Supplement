import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const PRISMA_DELEGATES = ["session", "page", "media", "shopSettings"] as const;

function isStalePrismaClient(client: PrismaClient): boolean {
  return PRISMA_DELEGATES.some((name) => !(name in client));
}

function createPrismaClient() {
  return new PrismaClient();
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
