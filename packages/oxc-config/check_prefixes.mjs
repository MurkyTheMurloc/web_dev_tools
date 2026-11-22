// Fails when a rule in linting/*.jsonc is named without its plugin prefix.
// oxlint resolves a bare name to one plugin of its own choosing: "no-lonely-if"
// set to "off" for unicorn switched off the eslint rule, and "expect-expect"
// resolved to jest, which is not loaded, so the vitest rule never ran.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const lintingDir = new URL("./linting/", import.meta.url);
// The bin through the running runtime, so it works under Bun and Node alike.
const oxlintPackage = createRequire(import.meta.url).resolve(
    "oxlint/package.json"
);
const oxlintBin = join(dirname(oxlintPackage), "bin/oxlint");
const listing = spawnSync(
    process.execPath,
    [oxlintBin, "--rules", "--format", "json"],
    {
        encoding: "utf8"
    }
);
const ruleNames = new Set(
    JSON.parse(listing.stdout).map((rule) => {
        return rule.value;
    })
);

const bare = [];
for (const file of readdirSync(lintingDir).filter((name) =>
    name.endsWith(".jsonc")
)) {
    const lines = readFileSync(new URL(file, lintingDir), "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
        // Rules sit at least two levels deep; top-level keys such as
        // "globals" are config, not rules.
        const key = /^ {8,}"([a-z0-9-]+)"\s*:/u.exec(line)?.[1];
        if (key && ruleNames.has(key)) {
            bare.push(`linting/${file}:${index + 1}: "${key}"`);
        }
    }
}

if (bare.length > 0) {
    console.error(
        `Rules without a plugin prefix (write "eslint/${"<name>"}", "unicorn/<name>", ...):\n${bare.join("\n")}`
    );
    process.exit(1);
}
console.log("every rule in linting/ has its plugin prefix");
