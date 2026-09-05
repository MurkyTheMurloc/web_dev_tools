import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      bun_logger: "./src/bun_logger.ts",
      logger: "./src/logger.ts",
      // `logger_factory` is shared by entries in both config blocks below, and both
      // blocks write it to the same `dist/logger_factory.js`. A module that is only
      // reached as a dependency keeps just the exports its own block's entries use,
      // so whichever block finished last decided the file's export list — and the
      // neutral block does not use `setSpanContextReader`, which left
      // `dist/otel.js` importing a binding that was not there. Naming it as an entry
      // in both blocks preserves its full surface either way.
      logger_factory: "./src/logger_factory.ts",
      otel: "./src/otel.ts",
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
      // See the note in the block above: both blocks emit this file, so both have to
      // treat it as an entry or the loser truncates it.
      logger_factory: "./src/logger_factory.ts",
      web_logger: "./src/web_logger.ts",
    },
    dts: true,
    format: "esm",
    outDir: "dist",
    platform: "neutral",
    unbundle: true,
  },
]);
