import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guards the exports map against the way it silently rots: a helper moves into a
 * new module, `exports["./thing"]` gains an entry, and the matching tsdown entry
 * is forgotten. Nothing fails at build time — the subpath just resolves to a file
 * that was never emitted, and only a consumer finds out.
 */
const packageRoot = path.resolve(import.meta.dir, "../..");
const pkg = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as { exports: Record<string, string | { import?: string }> };

const subpaths = Object.entries(pkg.exports).filter(([key]) => key !== "./package.json");

for (const [key, target] of subpaths) {
    const file = typeof target === "string" ? target : target.import;
    if (file === undefined) {
        throw new Error(`exports["${key}"] has no import condition`);
    }

    const resolved = path.join(packageRoot, file);
    let source: string;
    try {
        source = readFileSync(resolved, "utf8");
    } catch {
        throw new Error(
            `exports["${key}"] points at ${file}, which the build did not emit — add it to tsdown.config.ts`,
        );
    }

    // An entry that emitted but exports nothing is the same bug wearing a hat.
    if (file.endsWith(".js") && source.trim() !== "" && !source.includes("export")) {
        throw new Error(`exports["${key}"] resolved to ${file}, which exports nothing`);
    }
}

// The split only pays off if a group entry carries its own group and nothing else.
const guards = readFileSync(path.join(packageRoot, "dist/guards.js"), "utf8");
for (const absent of ["parseDomainName", "isEmptyLike", "uuidRegex", "arrayContainsCommonValue"]) {
    if (guards.includes(absent)) {
        throw new Error(`dist/guards.js pulled in ${absent} — the groups are no longer independent`);
    }
}

const result = readFileSync(path.join(packageRoot, "dist/result.js"), "utf8");
if (result.includes("import")) {
    throw new Error("dist/result.js gained a dependency; ok/err are meant to stand alone");
}

console.log(`Subpath smoke passed (${subpaths.length} entry points).`);
