import { prismaAdapter } from "@hot-updater/server/adapters/prisma";

import prisma from "../../db.server";

export const databaseAdapter = prismaAdapter({
  prisma,
  provider: "postgresql",
});
