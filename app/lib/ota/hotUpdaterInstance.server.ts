import { createHotUpdater } from "@hot-updater/server";
import { kyselyAdapter } from "@hot-updater/server/adapters/kysely";

import { db, databaseAdapter } from "./db.server";
import { fsRuntimeStorage } from "./storage.server";
import { ShopScopePlugin } from "./shopScope.server";

const BASE_PATH = "/hot-updater";
const ROUTES = { updateCheck: true, bundles: true } as const;

// Exported as `hotUpdater` because the CLI's `hot-updater db migrate` /
// `db generate` commands look for exactly that named export when given a
// config path (see package.json's "ota:migrate" script). This instance is
// intentionally UNSCOPED: migrations create/alter tables and must not carry a
// per-shop WHERE clause. It is only used by the CLI, never to serve requests.
export const hotUpdater = createHotUpdater({
  database: databaseAdapter,
  storages: [fsRuntimeStorage],
  basePath: BASE_PATH,
  routes: ROUTES,
});

// One Hot Updater instance per shop, each backed by the SAME connection pool
// (db.withPlugin shares the underlying driver) but a ShopScopePlugin that
// isolates the bundles / bundle_patches tables. Memoized because building an
// instance is cheap but pointless to repeat, and the set of shops is small
// and bounded by installs. Request handling always goes through here — never
// the unscoped `hotUpdater` above — so no request can touch another shop's
// bundles.
type HotUpdaterInstance = ReturnType<typeof createHotUpdater>;
const scopedInstances = new Map<string, HotUpdaterInstance>();

export function getScopedHotUpdater(shop: string): HotUpdaterInstance {
  const key = shop.trim();
  if (!key) {
    throw new Error(
      "[ota] getScopedHotUpdater requires a non-empty shop — refusing to serve an unscoped (cross-tenant) request.",
    );
  }

  let instance = scopedInstances.get(key);
  if (!instance) {
    instance = createHotUpdater({
      database: kyselyAdapter({
        db: db.withPlugin(new ShopScopePlugin(key)),
        provider: "postgresql",
      }),
      storages: [fsRuntimeStorage],
      basePath: BASE_PATH,
      routes: ROUTES,
    });
    scopedInstances.set(key, instance);
  }
  return instance;
}
