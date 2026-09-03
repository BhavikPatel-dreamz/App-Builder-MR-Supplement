import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { gutenbergBlockKitVite } from 'gutenberg-block-kit/vite';

const prismaClient = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "app/generated/prisma/client.ts",
);


// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    gutenbergBlockKitVite()
  ],
  build: {
    assetsInlineLimit: 0,
    // Gutenberg editor is a single ~19MB client chunk; splitting it is not practical.
    chunkSizeWarningLimit: 20000,
  },
  resolve: {
    alias: {
      // Shopify session storage still imports from @prisma/client (Prisma 6).
      "@prisma/client": prismaClient,
    },
    dedupe: ["react", "react-dom", "react-router", "@wordpress/element"],
  },
  optimizeDeps: {
    include: [
      "@shopify/app-bridge-react",
    ],
    exclude: [
      "gutenberg-block-kit/editor",
    ],
  },
}) satisfies UserConfig;
