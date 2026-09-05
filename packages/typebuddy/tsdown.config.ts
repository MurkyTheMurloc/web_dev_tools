import type { UserConfig } from "tsdown";

const config = [
  {
    entry: {
      index: "./src/index.ts",
      globals: "./globals.ts",
      // One entry per published subpath. Without them tsdown emits a single
      // graph reachable from `index`, so `exports["./guards"]` would point at
      // a file that was never built.
      collections: "./src/collections.ts",
      empty: "./src/empty.ts",
      guards: "./src/guards.ts",
      ids: "./src/ids.ts",
      parse: "./src/parse.ts",
      result: "./src/result.ts",
    },
    clean: true,
    dts: false,
    format: "esm",
    outDir: "dist",
    platform: "neutral",
    treeshake: true,
    unbundle: true,
  },
  {
    entry: {
      oxlint: "./oxlint/index.ts",
      biome: "./biome/index.ts",
    },
    clean: false,
    dts: false,
    // tsdown defaults `fixedExtension` to true for platform "node", which emits
    // .mjs. The package is "type": "module", so .js is already ESM and matches
    // what the exports map points at.
    fixedExtension: false,
    format: "esm",
    outDir: "dist",
    platform: "node",
    treeshake: true,
    unbundle: true,
  },
] satisfies UserConfig[];

export default config;
