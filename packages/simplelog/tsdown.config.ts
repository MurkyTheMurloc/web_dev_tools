import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      bun_logger: "./src/bun_logger.ts",
      logger: "./src/logger.ts",
    },
    dts: true,
    // tsdown defaults `fixedExtension` to true for platform "node", which emits
    // .mjs/.d.mts. The package is "type": "module", so .js is already ESM and
    // matches what the exports map (and every released version) points at.
    fixedExtension: false,
    format: "esm",
    outDir: "dist",
    platform: "node",
    unbundle: true,
  },
  {
    entry: {
      deno_logger: "./src/deno_logger.ts",
      hono_middleware: "./src/hono_middleware.ts",
      web_logger: "./src/web_logger.ts",
    },
    dts: true,
    format: "esm",
    outDir: "dist",
    platform: "neutral",
    unbundle: true,
  },
]);
