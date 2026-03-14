import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    main: "./src/type_helper.ts",
  },
  dts: true,
  format: "esm",
  outDir: "dist",
  platform: "neutral",
});
