import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "./src/type_helper.ts",
      types: "./src/types/index.ts",
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
      eslint: "./eslint/index.ts",
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
]);
