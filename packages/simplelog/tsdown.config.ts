import { defineConfig } from "tsdown";

// Modules that entries of both config blocks reach. Both blocks write them to the
// same `dist/` file, and a module that is only reached as a dependency keeps just
// the exports its own block's entries use, so whichever block finished last
// decided the file's export list. 2.0.0 shipped a `dist/otel.js` importing a
// `setSpanContextReader` that `dist/logger_factory.js` did not export, because
// the neutral block does not use it. Naming each shared module as an entry in
// both blocks keeps its full surface either way.
const SHARED_ENTRIES = {
    console_text: "./src/console_text.ts",
    logger_factory: "./src/logger_factory.ts",
    serialize_value: "./src/serialize_value.ts"
};

export default defineConfig([
    {
        dts: true,
        entry: {
            ...SHARED_ENTRIES,
            bun_logger: "./src/bun_logger.ts",
            logger: "./src/logger.ts",
            otel: "./src/otel.ts"
        },
        // tsdown defaults `fixedExtension` to true for platform "node", which emits
        // .mjs/.d.mts. The package is "type": "module", so .js is already ESM and
        // matches what the exports map (and every released version) points at.
        fixedExtension: false,
        format: "esm",
        outDir: "dist",
        platform: "node",
        unbundle: true
    },
    {
        dts: true,
        entry: {
            ...SHARED_ENTRIES,
            browser_logger: "./src/browser_logger.ts",
            hono_middleware: "./src/hono_middleware.ts",
            web_logger: "./src/web_logger.ts"
        },
        format: "esm",
        outDir: "dist",
        platform: "neutral",
        unbundle: true
    }
]);
