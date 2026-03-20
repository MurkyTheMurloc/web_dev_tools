import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    copyPath,
    detectPackageManager,
    ensurePackageJson,
    installDevDependencies,
    updatePackageScripts,
} from "./install-utils.mjs";

const BASE_EXTENDS = [
    "./linting/base.jsonc",
    "./linting/eslint.jsonc",
    "./linting/typescript.jsonc",
    "./linting/unicorn.jsonc",
    "./linting/oxc.jsonc",
    "./linting/import.jsonc",
    "./linting/jsx_a11y.jsonc",
    "./linting/vitest.jsonc",
    "./linting/promise.jsonc",
    "./linting/node.jsonc",
    "./linting/jsdoc.jsonc",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const oxcSourceDir = path.join(repoRoot, "oxc");
const require = createRequire(import.meta.url);

export async function installOxcConfig({
    frontendSolid = false,
    simplelog = false,
    typebuddy = false,
    targetDir = process.cwd(),
    packageManager,
    skipInstall = false,
} = {}) {
    const resolvedTargetDir = path.resolve(targetDir);
    const packageJsonPath = ensurePackageJson(resolvedTargetDir);
    const resolvedPackageManager = detectPackageManager(
        resolvedTargetDir,
        packageManager,
    );

    copyPath(
        path.join(oxcSourceDir, ".oxlintrc.jsonc"),
        path.join(resolvedTargetDir, "oxc", ".oxlintrc.jsonc"),
    );
    copyPath(
        path.join(oxcSourceDir, ".oxfmtrc.jsonc"),
        path.join(resolvedTargetDir, "oxc", ".oxfmtrc.jsonc"),
    );
    copyPath(
        path.join(oxcSourceDir, "linting"),
        path.join(resolvedTargetDir, "oxc", "linting"),
    );

    if (frontendSolid) {
        copyPath(
            resolveSolidJsPluginSourceDir(),
            path.join(resolvedTargetDir, "oxc", "jsplugins", "solid"),
        );
    }

    updateOxcConfig(path.join(resolvedTargetDir, "oxc", ".oxlintrc.jsonc"), {
        frontendSolid,
        simplelog,
        typebuddy,
    });

    updatePackageScripts(packageJsonPath, {
        "format:oxc": "oxfmt -c ./oxc/.oxfmtrc.jsonc .",
        "format:oxc:check": "oxfmt -c ./oxc/.oxfmtrc.jsonc --check .",
        "lint:oxc": "oxlint -c ./oxc/.oxlintrc.jsonc --type-aware .",
    });

    installDevDependencies({
        targetDir: resolvedTargetDir,
        packageManager: resolvedPackageManager,
        packages: [
            "oxfmt",
            "oxlint",
            "oxlint-tsgolint@latest",
            ...(frontendSolid
                ? [
                      "@typescript-eslint/utils",
                      "eslint",
                      "estraverse",
                      "is-html",
                      "kebab-case",
                      "known-css-properties",
                      "style-to-object",
                      "typescript",
                  ]
                : []),
        ],
        skipInstall,
    });

    return {
        packageManager: resolvedPackageManager,
        skipInstall,
        targetDir: resolvedTargetDir,
    };
}

function resolveSolidJsPluginSourceDir() {
    try {
        return path.dirname(require.resolve("@murky-web/oxlint-plugin-solid"));
    } catch (error) {
        throw new Error(
            "Could not resolve @murky-web/oxlint-plugin-solid. Install @murky-web/config with its workspace dependencies before using --frontend-solid.",
            { cause: error },
        );
    }
}

function updateOxcConfig(configPath, { frontendSolid, simplelog, typebuddy }) {
    let next = readFileSync(configPath, "utf8");

    const desiredExtends = [
        ...BASE_EXTENDS,
        ...(typebuddy ? ["./linting/typebuddy.jsonc"] : []),
        ...(simplelog ? ["./linting/simplelog.jsonc"] : []),
        ...(frontendSolid ? ["./linting/solid.jsonc"] : []),
    ];

    next = next.replace(
        /"extends": \[[\s\S]*?\n\s*\],/u,
        `"extends": [\n${desiredExtends.map((entry) => `        "${entry}"`).join(",\n")}\n    ],`,
    );

    const jsPlugins = [];
    if (frontendSolid) {
        jsPlugins.push("./jsplugins/solid/index.mjs");
    }
    if (typebuddy) {
        jsPlugins.push("@murky-web/typebuddy/oxlint");
    }
    if (simplelog) {
        jsPlugins.push("@murky-web/simplelog/oxlint");
    }

    next = upsertJsPlugins(next, jsPlugins);

    if (frontendSolid && !next.includes(`"ignorePatterns": [`)) {
        const pluginsMarker = `    "plugins": [`;
        if (!next.includes(pluginsMarker)) {
            throw new Error(
                "Could not update .oxlintrc.jsonc: expected plugins marker not found.",
            );
        }

        next = next.replace(
            pluginsMarker,
            `    "ignorePatterns": [\n        "./jsplugins/**"\n    ],\n    "plugins": [`,
        );
    }

    writeFileSync(configPath, next);
}

function upsertJsPlugins(configSource, jsPlugins) {
    if (jsPlugins.length === 0) {
        return configSource;
    }

    const desiredEntries = jsPlugins.map((plugin) => `        "${plugin}"`);

    if (configSource.includes(`"jsPlugins": [`)) {
        return configSource.replace(
            /"jsPlugins": \[[\s\S]*?\n\s*\],/u,
            `"jsPlugins": [\n${desiredEntries.join(",\n")}\n    ],`,
        );
    }

    const pluginMarker = `    "plugins": [`;
    if (!configSource.includes(pluginMarker)) {
        throw new Error(
            "Could not update .oxlintrc.jsonc: expected plugins marker not found.",
        );
    }

    return configSource.replace(
        pluginMarker,
        `    "jsPlugins": [\n${desiredEntries.join(",\n")}\n    ],\n    "plugins": [`,
    );
}
