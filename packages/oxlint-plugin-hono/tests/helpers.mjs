import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const REPO_ROOT = decodeURIComponent(
    new URL("../../../", import.meta.url).pathname
);
const PLUGIN_PATH = decodeURIComponent(
    new URL("../src/index.mjs", import.meta.url).pathname
);
const OXLINT_BIN = join(
    dirname(createRequire(import.meta.url).resolve("oxlint/package.json")),
    "bin/oxlint"
);

// What Oxlint prints when the plugin does not load or a rule throws, or when
// the fixture does not parse: every "stays silent" case would pass on it.
const FAILURE_PATTERN =
    /Failed to load JS plugin|Error running JS plugin|Failed to parse oxlint configuration|^\s*x (?![\w-]+\([^)]*\):)/mu;
// The summary line of the default format, only there when Oxlint finished.
const FINISHED_PATTERN = /^Finished in \d/mu;

/**
 * Lints fixtures in a temp project that loads this plugin from `src/`.
 * `extends` takes paths relative to the repo root (shared configs from
 * packages/oxc-config), `plugins` the built-in plugins they need.
 */
export function createLintHarness() {
    const directory = mkdtempSync(join(tmpdir(), "oxlint-plugin-hono-"));

    return {
        cleanup() {
            rmSync(directory, { force: true, recursive: true });
        },
        lint(
            code,
            {
                extends: extendsPaths = [],
                fileName = "case.ts",
                jsPlugins = [PLUGIN_PATH],
                plugins = [],
                rules = {}
            } = {}
        ) {
            writeFileSync(
                join(directory, ".oxlintrc.json"),
                JSON.stringify({
                    extends: extendsPaths.map((path) => join(REPO_ROOT, path)),
                    jsPlugins,
                    plugins,
                    rules
                })
            );
            writeFileSync(join(directory, fileName), code);
            const args = ["-c", ".oxlintrc.json", "--format=default", fileName];
            // Without `CI`, Oxlint prints the same plain text locally and in CI.
            const { CI: _ci, ...env } = process.env;
            const result = spawnSync(process.execPath, [OXLINT_BIN, ...args], {
                cwd: directory,
                encoding: "utf8",
                env
            });
            const output = `${result.stdout}${result.stderr}`.trim();
            if (
                FAILURE_PATTERN.test(output) ||
                !FINISHED_PATTERN.test(output)
            ) {
                throw new Error(`Oxlint did not run the plugin:\n${output}`);
            }

            return {
                // Oxlint wraps long messages onto `  | ` continuation lines.
                output: output.replace(/\n\s*\| /gu, " "),
                source: readFileSync(join(directory, fileName), "utf8")
            };
        }
    };
}

export function countOccurrences(text, fragment) {
    return text.split(fragment).length - 1;
}
