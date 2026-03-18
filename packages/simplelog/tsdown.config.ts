import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      bun_logger: "./src/bun_logger.ts",
      logger: "./src/logger.ts",
    },
    dts: true,
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
