import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Imports every published entry point for real.
 *
 * 2.0.0 shipped a `/otel` entry that threw on import: `dist/otel.js` imported
 * `setSpanContextReader` from `dist/logger_factory.js`, which did not export it.
 * Nothing caught that, because every other check reads the source. The build emits
 * `logger_factory.js` from two tsdown config blocks writing the same `outDir`, and a
 * module reached only as a dependency keeps just the exports its own block's entries
 * use — so whichever block finished last decided the export list, and that order is
 * not fixed. Type-checking the source cannot see it; only loading the built files can.
 *
 * A `d.ts` next to a `.js` is no proof either: the declaration is generated from the
 * source, so it described an export the JavaScript did not have.
 */
const packageRoot = path.resolve(import.meta.dir, "../..");
const pkg = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as { name: string; exports: Record<string, string | { import?: string }> };

const failures: string[] = [];
let loaded = 0;

for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === "./package.json") {
        continue;
    }

    const file = typeof target === "string" ? target : target.import;
    if (file === undefined) {
        failures.push(`exports["${subpath}"] has no import condition`);
        continue;
    }

    const resolved = path.join(packageRoot, file);
    try {
        const module: Record<string, unknown> = await import(resolved);
        const names = Object.keys(module).filter((name) => name !== "default");
        if (names.length === 0) {
            failures.push(`${subpath} -> ${file} loaded but exports nothing`);
            continue;
        }
        loaded += 1;
        console.log(`  ok  ${subpath.padEnd(12)} ${names.join(", ")}`);
    } catch (error) {
        // An unresolved import between two built files surfaces here and nowhere else.
        failures.push(
            `${subpath} -> ${file} failed to load: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

if (failures.length > 0) {
    console.error(`\n${failures.length} entry point(s) failed:`);
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    process.exit(1);
}

console.log(`\nEntry smoke passed (${loaded} entry points loaded).`);
