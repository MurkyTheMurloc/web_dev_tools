import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    logger: "./src/logger.ts",
  },
  dts: true,
  format: "esm",
  outDir: "dist",
  platform: "node",
});
