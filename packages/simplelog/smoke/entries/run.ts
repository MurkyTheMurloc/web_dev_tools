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

const NO_EXPORTS = 0;
const NO_FAILURES = 0;
const ONE_ENTRY = 1;
const SUBPATH_COLUMN_WIDTH = 12;
const FAILURE_EXIT_CODE = 1;

function resolveImportTarget(
    target: string | { import?: string },
): string | undefined {
    if (typeof target === "string") {
        return target;
    }

    return target.import;
}

function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

const failures: string[] = [];
let loaded = 0;

for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === "./package.json") {
        continue;
    }

    const file = resolveImportTarget(target);
    if (file === undefined) {
        failures.push(`exports["${subpath}"] has no import condition`);
        continue;
    }

    const resolved = path.join(packageRoot, file);
    try {
        const module: Record<string, unknown> = await import(resolved);
        const names = Object.keys(module).filter((name) => {
            return name !== "default";
        });
        if (names.length === NO_EXPORTS) {
            failures.push(`${subpath} -> ${file} loaded but exports nothing`);
            continue;
        }
        loaded += ONE_ENTRY;
        console.log(`  ok  ${subpath.padEnd(SUBPATH_COLUMN_WIDTH)} ${names.join(", ")}`);
    } catch (error) {
        // An unresolved import between two built files surfaces here and nowhere else.
        failures.push(
            `${subpath} -> ${file} failed to load: ${describeError(error)}`,
        );
    }
}

if (failures.length > NO_FAILURES) {
    console.error(`\n${failures.length} entry point(s) failed:`);
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    process.exit(FAILURE_EXIT_CODE);
}

console.log(`\nEntry smoke passed (${loaded} entry points loaded).`);
