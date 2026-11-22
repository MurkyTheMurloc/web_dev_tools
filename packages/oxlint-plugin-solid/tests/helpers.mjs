import { spawnSync } from "node:child_process";
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";

const EXIT_SUCCESS = 0;
const FIXTURE_FILE_PATH = "src/rule_case.tsx";
const OXLINT_CONFIG_PATH = "./.oxlintrc.jsonc";
const CASE_CONFIG_PATH = "./.oxlintrc.case.jsonc";
// `os.tmpdir()` follows `$TMPDIR`, so the harness also runs where `/tmp` is
// read-only (agent sandboxes).
const TEMP_DIRECTORY_PATTERN = `${tmpdir()}/oxlint-plugin-solid-XXXXXX`;
// What Oxlint prints when the plugin does not load (a dependency that does not
// resolve, a changed export) or a rule throws. Every "stays silent" case would
// pass on such output, so the harness refuses it.
const PLUGIN_FAILURE_PATTERN =
    /Failed to load JS plugin|Error running JS plugin|Failed to parse oxlint configuration/u;
// The summary line of the default format: it is only there when Oxlint ran to
// the end. The default format is pinned because Oxlint picks another one when
// it detects an agent or CI.
const FINISHED_PATTERN = /^Finished in \d/mu;
// A parser error is a diagnostic without a `plugin(rule)` code, like
// `x Unexpected token`. The rules see no tree for a file that does not parse, so
// every "stays silent" case would pass on it. The unused-disable-directive report
// has no code either and is not a parser error.
const PARSER_ERROR_PATTERN =
    /^\s*x (?![\w-]+\([^)]*\):|Unused \S+-disable directive)/mu;
const PACKAGE_RUNTIME_DEPENDENCIES = [
    "@eslint-community",
    "@solidjs",
    "estraverse",
    "is-html",
    "kebab-case",
    "known-css-properties",
    "parse5",
    "solid-js",
    "style-to-object",
    "validate-html-nesting"
];

function getRepoRoot() {
    return decodeURIComponent(new URL("../../../", import.meta.url).pathname);
}

function joinOutput(result) {
    return `${result.stdout}${result.stderr}`.trim();
}

// With `CI` set, Oxlint prints colors and a `×` marker even with `NO_COLOR`
// and `--format=default`. The assertions read plain text, so the commands run
// without it and the output is the same locally and in CI.
function commandEnvironment() {
    const { CI: _ci, ...environment } = process.env;

    return environment;
}

function runCommand([command, ...args], cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: commandEnvironment()
    });

    return {
        // A command that did not start has no status; that is a failure.
        exitCode: result.status ?? 1,
        stderr: result.error?.message ?? result.stderr,
        stdout: result.stdout
    };
}

function runCommandOrThrow(cmd, cwd) {
    const result = runCommand(cmd, cwd);
    if (result.exitCode === EXIT_SUCCESS) {
        return result;
    }

    throw new Error(joinOutput(result));
}

function createTempDirectory(repoRoot) {
    const result = runCommandOrThrow(
        ["mktemp", "-d", TEMP_DIRECTORY_PATTERN],
        repoRoot
    );

    return joinOutput(result);
}

function resolveDependencySourcePath({
    dependencyName,
    packageNodeModulesPath,
    rootNodeModulesPath
}) {
    const packageScopedPath = `${packageNodeModulesPath}/${dependencyName}`;
    if (existsSync(packageScopedPath)) {
        return packageScopedPath;
    }

    const rootScopedPath = `${rootNodeModulesPath}/${dependencyName}`;
    if (existsSync(rootScopedPath)) {
        return rootScopedPath;
    }

    throw new Error(
        `Could not resolve dependency '${dependencyName}' from either ${packageNodeModulesPath} or ${rootNodeModulesPath}.`
    );
}

function createTempPackageManifest(tempDirectoryPath) {
    writeFileSync(
        `${tempDirectoryPath}/package.json`,
        `${JSON.stringify({ name: "solid-oxlint-test", private: true }, null, 2)}\n`
    );
}

function initializeTempProject(repoRoot, tempDirectoryPath) {
    const rootNodeModulesPath = `${repoRoot}/node_modules`;
    const packageNodeModulesPath = `${repoRoot}/packages/oxlint-plugin-solid/node_modules`;
    const solidPluginPackagePath = `${repoRoot}/packages/oxlint-plugin-solid`;
    const dependencyLinkPairs = [
        [
            `${rootNodeModulesPath}/.bin`,
            `${tempDirectoryPath}/node_modules/.bin`
        ],
        [
            solidPluginPackagePath,
            `${tempDirectoryPath}/node_modules/@murky-web/oxlint-plugin-solid`
        ],
        [
            `${rootNodeModulesPath}/@typescript`,
            `${tempDirectoryPath}/node_modules/@typescript`
        ],
        [
            `${rootNodeModulesPath}/oxlint-tsgolint`,
            `${tempDirectoryPath}/node_modules/oxlint-tsgolint`
        ]
    ];
    for (const dependencyName of PACKAGE_RUNTIME_DEPENDENCIES) {
        dependencyLinkPairs.push([
            resolveDependencySourcePath({
                dependencyName,
                packageNodeModulesPath,
                rootNodeModulesPath
            }),
            `${tempDirectoryPath}/node_modules/${dependencyName}`
        ]);
    }

    writeSolidProjectConfig(repoRoot, tempDirectoryPath);
    runCommandOrThrow(
        ["mkdir", "-p", `${tempDirectoryPath}/node_modules`],
        repoRoot
    );
    runCommandOrThrow(
        ["mkdir", "-p", `${tempDirectoryPath}/node_modules/@murky-web`],
        repoRoot
    );
    for (const [sourcePath, targetPath] of dependencyLinkPairs) {
        runCommandOrThrow(["ln", "-s", sourcePath, targetPath], repoRoot);
    }
    runCommandOrThrow(["mkdir", "-p", `${tempDirectoryPath}/src`], repoRoot);
    neutralizeUnresolvableTypes(tempDirectoryPath);
}

// The shared configs from config/ as a Solid project sees them: the rule
// files under oxc/linting, an .oxlintrc extending them with the Solid
// plugin, and the client tsconfig on top of the base.
const LINTING_FILES = [
    "base",
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "import",
    "jsx_a11y",
    "vitest",
    "promise",
    "node",
    "jsdoc",
    "solid"
];

// `rules` overrides single rules on top of the shared configs, for cases that
// test a rule's options.
function solidProjectConfig(rules = {}) {
    return {
        extends: LINTING_FILES.map((name) => `./oxc/linting/${name}.jsonc`),
        jsPlugins: ["@murky-web/oxlint-plugin-solid"],
        plugins: [
            "eslint",
            "typescript",
            "unicorn",
            "oxc",
            "import",
            "jsx-a11y",
            "vitest",
            "promise",
            "node",
            "jsdoc"
        ],
        rules
    };
}

function writeSolidProjectConfig(repoRoot, tempDirectoryPath) {
    const configRoot = `${repoRoot}/config`;
    cpSync(
        `${repoRoot}/packages/oxc-config/linting`,
        `${tempDirectoryPath}/oxc/linting`,
        {
            recursive: true
        }
    );
    writeFileSync(
        `${tempDirectoryPath}/${OXLINT_CONFIG_PATH}`,
        JSON.stringify(solidProjectConfig())
    );
    copyFileSync(
        `${configRoot}/typescript/tsconfig.base.jsonc`,
        `${tempDirectoryPath}/tsconfig.base.jsonc`
    );
    copyFileSync(
        `${configRoot}/typescript/tsconfig.client.jsonc`,
        `${tempDirectoryPath}/tsconfig.json`
    );
}

// The templates are written for real projects; the harness links a handful of
// packages by hand and vite is not among them, so `types: ["vite/client"]`
// would raise TS2688 and fail the whole project before any rule runs. It is
// not under test here, so it is neutralized. `jsxImportSource` stays: the
// fixtures are typed by the real `@solidjs/web` (a devDependency), as in a
// Solid 2.0 project, where `JSX` is imported from it and is no global.
function neutralizeUnresolvableTypes(tempDirectoryPath) {
    const tsconfigPath = `${tempDirectoryPath}/tsconfig.json`;
    if (!existsSync(tsconfigPath)) {
        return;
    }
    writeFileSync(
        tsconfigPath,
        readFileSync(tsconfigPath, "utf8").replace(
            /"types"\s*:\s*\[[^\]]*\]/,
            '"types": []'
        )
    );
}

function writeFixtureFile(filePath, code) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, code);
}

export async function createLintHarness() {
    const repoRoot = getRepoRoot();
    const tempDirectoryPath = createTempDirectory(repoRoot);
    createTempPackageManifest(tempDirectoryPath);
    initializeTempProject(repoRoot, tempDirectoryPath);

    return {
        async cleanup() {
            runCommandOrThrow(["rm", "-rf", tempDirectoryPath], repoRoot);
        },
        getRepoRoot() {
            return repoRoot;
        },
        // `fileName` places the fixture elsewhere in the temp project, and
        // `files` writes more files next to it (path -> content) for rules that
        // read other modules. `rules` overrides rules (with their options) on
        // top of the shared configs, `flags` adds Oxlint flags such as
        // `--fix-suggestions`. A fixture that does not parse is an error.
        async lint(
            code,
            {
                fix = false,
                fileName = FIXTURE_FILE_PATH,
                files = {},
                flags = [],
                rules
            } = {}
        ) {
            const fixturePath = `${tempDirectoryPath}/${fileName}`;
            for (const [path, content] of Object.entries(files)) {
                writeFixtureFile(`${tempDirectoryPath}/${path}`, content);
            }

            writeFixtureFile(fixturePath, code);

            let configPath = OXLINT_CONFIG_PATH;
            if (rules !== undefined) {
                configPath = CASE_CONFIG_PATH;
                writeFileSync(
                    `${tempDirectoryPath}/${configPath}`,
                    JSON.stringify(solidProjectConfig(rules))
                );
            }

            const cmd = [
                `${repoRoot}/node_modules/.bin/oxlint`,
                "-c",
                configPath,
                "--format=default",
                ...flags
            ];
            if (fix) {
                cmd.push("--fix");
            }
            cmd.push(fileName);

            const result = runCommand(cmd, tempDirectoryPath);
            const output = joinOutput(result);
            if (PLUGIN_FAILURE_PATTERN.test(output)) {
                throw new Error(`The plugin did not run:\n${output}`);
            }
            if (!FINISHED_PATTERN.test(output)) {
                throw new Error(`Oxlint did not finish:\n${output}`);
            }
            if (PARSER_ERROR_PATTERN.test(output)) {
                throw new Error(`The fixture does not parse:\n${output}`);
            }

            return {
                exitCode: result.exitCode,
                output,
                source: readFileSync(fixturePath, "utf8")
            };
        }
    };
}
