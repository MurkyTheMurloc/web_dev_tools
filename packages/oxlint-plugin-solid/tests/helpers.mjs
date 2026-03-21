import { existsSync } from "node:fs";

const EXIT_SUCCESS = 0;
const FIXTURE_FILE_PATH = "src/rule_case.tsx";
const OXLINT_CONFIG_PATH = "./.oxlintrc.jsonc";
const TEMP_DIRECTORY_PATTERN = "/tmp/oxlint-plugin-solid-XXXXXX";
const PACKAGE_RUNTIME_DEPENDENCIES = [
    "@typescript-eslint",
    "eslint",
    "estraverse",
    "is-html",
    "kebab-case",
    "known-css-properties",
    "solid-js",
    "style-to-object",
];

function decodeBuffer(buffer) {
    return new TextDecoder().decode(buffer);
}

function getRepoRoot() {
    return decodeURIComponent(new URL("../../../", import.meta.url).pathname);
}

function joinOutput(result) {
    return `${decodeBuffer(result.stdout)}${decodeBuffer(result.stderr)}`.trim();
}

function runCommand(cmd, cwd) {
    return globalThis.Bun.spawnSync({
        cmd,
        cwd,
        stderr: "pipe",
        stdout: "pipe",
    });
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
        repoRoot,
    );

    return joinOutput(result);
}

function resolveDependencySourcePath({
    dependencyName,
    packageNodeModulesPath,
    rootNodeModulesPath,
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
        `Could not resolve dependency '${dependencyName}' from either ${packageNodeModulesPath} or ${rootNodeModulesPath}.`,
    );
}

async function createTempPackageManifest(tempDirectoryPath) {
    await globalThis.Bun.write(
        `${tempDirectoryPath}/package.json`,
        `${JSON.stringify({ name: "solid-oxlint-test", private: true }, null, 2)}\n`,
    );
}

function initializeTempProject(repoRoot, tempDirectoryPath) {
    const rootNodeModulesPath = `${repoRoot}/node_modules`;
    const packageNodeModulesPath = `${repoRoot}/packages/oxlint-plugin-solid/node_modules`;
    const solidPluginPackagePath = `${repoRoot}/packages/oxlint-plugin-solid`;
    const dependencyLinkPairs = [
        [
            `${rootNodeModulesPath}/.bin`,
            `${tempDirectoryPath}/node_modules/.bin`,
        ],
        [
            solidPluginPackagePath,
            `${tempDirectoryPath}/node_modules/@murky-web/oxlint-plugin-solid`,
        ],
        [
            `${rootNodeModulesPath}/@typescript`,
            `${tempDirectoryPath}/node_modules/@typescript`,
        ],
        [
            `${rootNodeModulesPath}/oxlint-tsgolint`,
            `${tempDirectoryPath}/node_modules/oxlint-tsgolint`,
        ],
    ];
    for (const dependencyName of PACKAGE_RUNTIME_DEPENDENCIES) {
        dependencyLinkPairs.push([
            resolveDependencySourcePath({
                dependencyName,
                packageNodeModulesPath,
                rootNodeModulesPath,
            }),
            `${tempDirectoryPath}/node_modules/${dependencyName}`,
        ]);
    }

    runCommandOrThrow(
        [
            "bun",
            `${repoRoot}/packages/config/bin/web-dev-config.mjs`,
            "init",
            "--oxc",
            "--typescript",
            "--frontend-solid",
            "--skip-install",
            tempDirectoryPath,
        ],
        repoRoot,
    );
    runCommandOrThrow(
        ["mkdir", "-p", `${tempDirectoryPath}/node_modules`],
        repoRoot,
    );
    runCommandOrThrow(
        ["mkdir", "-p", `${tempDirectoryPath}/node_modules/@murky-web`],
        repoRoot,
    );
    for (const [sourcePath, targetPath] of dependencyLinkPairs) {
        runCommandOrThrow(["ln", "-s", sourcePath, targetPath], repoRoot);
    }
    runCommandOrThrow(["mkdir", "-p", `${tempDirectoryPath}/src`], repoRoot);
}

function readTextFile(filePath) {
    return globalThis.Bun.file(filePath).text();
}

async function writeFixtureFile(filePath, code) {
    await globalThis.Bun.write(filePath, code);
}

export async function createLintHarness() {
    const repoRoot = getRepoRoot();
    const tempDirectoryPath = createTempDirectory(repoRoot);
    await createTempPackageManifest(tempDirectoryPath);
    initializeTempProject(repoRoot, tempDirectoryPath);

    return {
        async cleanup() {
            runCommandOrThrow(["rm", "-rf", tempDirectoryPath], repoRoot);
        },
        getRepoRoot() {
            return repoRoot;
        },
        async lint(code, { fix = false } = {}) {
            const fixturePath = `${tempDirectoryPath}/${FIXTURE_FILE_PATH}`;
            await writeFixtureFile(fixturePath, code);

            const cmd = [
                `${repoRoot}/node_modules/.bin/oxlint`,
                "-c",
                OXLINT_CONFIG_PATH,
            ];
            if (fix) {
                cmd.push("--fix");
            }
            cmd.push(FIXTURE_FILE_PATH);

            const result = runCommand(cmd, tempDirectoryPath);

            return {
                exitCode: result.exitCode,
                output: joinOutput(result),
                source: await readTextFile(fixturePath),
            };
        },
    };
}
