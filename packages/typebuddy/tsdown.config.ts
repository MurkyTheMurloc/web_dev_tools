import type { UserConfig } from "tsdown";

const config = [
  {
    entry: {
      index: "./src/index.ts",
      globals: "./src/types/globals.ts",
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
    format: "esm",
    outDir: "dist",
    platform: "node",
    treeshake: true,
    unbundle: true,
  },
] satisfies UserConfig[];

export default config;
