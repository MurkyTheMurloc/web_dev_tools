import type { UserConfig } from "tsdown";

const config = [
  {
    entry: {
      index: "./src/type_helper.ts",
      globals: "./src/types/globals.ts",
    },
    clean: true,
    dts: true,
    format: "esm",
    outDir: "dist",
    platform: "neutral",
    treeshake: true,
  },
  {
    entry: {
      oxlint: "./oxlint/index.ts",
      biome: "./biome/index.ts",
    },
    clean: false,
    dts: true,
    format: "esm",
    outDir: "dist",
    platform: "node",
    treeshake: true,
  },
] satisfies UserConfig[];

export default config;
