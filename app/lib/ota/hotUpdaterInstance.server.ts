import { createHotUpdater } from "@hot-updater/server";

import { databaseAdapter } from "./db.server";
import { fsRuntimeStorage } from "./storage.server";

// Exported as `hotUpdater` because the CLI's `hot-updater db generate`
// commands look for exactly that named export when given a config path.
export const hotUpdater = createHotUpdater({
  database: databaseAdapter,
  storages: [fsRuntimeStorage],
  basePath: "/hot-updater",
  routes: {
    updateCheck: true,
    bundles: true,
  },
});
