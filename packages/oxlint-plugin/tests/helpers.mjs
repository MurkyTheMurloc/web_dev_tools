import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = decodeURIComponent(
    new URL("../../../", import.meta.url).pathname
);
const PLUGIN_PATH = decodeURIComponent(
    new URL("../src/index.mjs", import.meta.url).pathname
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
    const directory = mkdtempSync(join(tmpdir(), "oxlint-plugin-"));

    return {
        cleanup() {
            rmSync(directory, { force: true, recursive: true });
        },
        lint(
            code,
            {
                extends: extendsPaths = [],
                fileName = "case.tsx",
                fix = false,
                plugins = [],
                rules = {}
            } = {}
        ) {
            writeFileSync(
                join(directory, ".oxlintrc.json"),
                JSON.stringify({
                    extends: extendsPaths.map((path) => join(REPO_ROOT, path)),
                    jsPlugins: [PLUGIN_PATH],
                    plugins,
                    rules
                })
            );
            writeFileSync(join(directory, fileName), code);
            const args = ["-c", ".oxlintrc.json", "--format=default"];
            if (fix) {
                args.push("--fix");
            }
            // Without `CI`, Oxlint prints the same plain text locally and in CI.
            const { CI: _ci, ...env } = process.env;
            const result = spawnSync(
                join(REPO_ROOT, "node_modules/.bin/oxlint"),
                [...args, fileName],
                { cwd: directory, encoding: "utf8", env }
            );
            const output = `${result.stdout}${result.stderr}`.trim();
            if (
                FAILURE_PATTERN.test(output) ||
                !FINISHED_PATTERN.test(output)
            ) {
                throw new Error(`Oxlint did not run the plugin:\n${output}`);
            }

            return {
                output,
                source: readFileSync(join(directory, fileName), "utf8")
            };
        }
    };
}
