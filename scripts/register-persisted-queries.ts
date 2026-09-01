#!/usr/bin/env tsx
/**
 * Register all catalog persisted queries on the Storefront gateway (Redis APQ map).
 *
 * Usage:
 *   pnpm register:queries
 *   pnpm register:queries --gateway=https://appbuilder.dreamzapps.com/graphql
 */

import { allPersistedQueries } from "../app/lib/persisted-queries";

function parseGateway(argv: string[]): string {
  for (const arg of argv) {
    if (arg.startsWith("--gateway=")) return arg.slice("--gateway=".length);
  }
  return process.env.SHOPIFY_APP_URL
    ? `${process.env.SHOPIFY_APP_URL.replace(/\/$/, "")}/graphql`
    : "https://appbuilder.dreamzapps.com/graphql";
}

async function registerQuery(
  gatewayUrl: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(gatewayUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ query, variables, cache: "default" }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as { errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
}

async function main() {
  const gatewayUrl = parseGateway(process.argv.slice(2));
  const queries = allPersistedQueries();

  console.log(`[register:queries] gateway=${gatewayUrl} count=${queries.length}`);

  for (const entry of queries) {
    const variables =
      entry.name === "ProductsByCollectionId"
        ? { id: "gid://shopify/Collection/568648040759", first: 1 }
        : { handle: "example-handle" };

    process.stdout.write(`[register:queries] ${entry.name} (${entry.sha256.slice(0, 12)}…)… `);
    await registerQuery(gatewayUrl, entry.query, variables);
    console.log("ok");
  }

  console.log("[register:queries] done.");
}

main().catch((err) => {
  console.error("[register:queries] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
