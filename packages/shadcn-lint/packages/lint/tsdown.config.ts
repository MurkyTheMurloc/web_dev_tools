import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // The Tailwind oracle's worker thread; loaded by URL from index.
    "tailwind-worker": "src/tailwind/worker.ts",
  },
  // ESM only: ESLint and Oxlint both import() the plugin, so no CommonJS
  // build is needed. (Node 22.12 and later can also require() it without a
  // flag; engines stays at >=22, as cn needs, since nothing here requires it.)
  format: ["esm"],
  dts: true,
  // tsdown defaults `fixedExtension` to true for platform "node", which
  // emits .mjs/.d.mts. The package is "type": "module", so .js is already
  // ESM and matches the exports map, the postbuild step and the worker URL.
  fixedExtension: false,
  hash: false,
  target: "es2022",
  minify: false,
  clean: true,
})
