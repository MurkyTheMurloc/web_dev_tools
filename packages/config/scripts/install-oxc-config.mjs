import { readFileSync, writeFileSync } from "node:fs";
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
    "./oxc/linting/base.jsonc",
    "./oxc/linting/eslint.jsonc",
    "./oxc/linting/typescript.jsonc",
    "./oxc/linting/unicorn.jsonc",
    "./oxc/linting/oxc.jsonc",
    "./oxc/linting/import.jsonc",
    "./oxc/linting/jsx_a11y.jsonc",
    "./oxc/linting/vitest.jsonc",
    "./oxc/linting/promise.jsonc",
    "./oxc/linting/node.jsonc",
    "./oxc/linting/jsdoc.jsonc",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const oxcSourceDir = path.join(repoRoot, "oxc");

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
        path.join(resolvedTargetDir, ".oxlintrc.jsonc"),
    );
    copyPath(
        path.join(oxcSourceDir, ".oxfmtrc.jsonc"),
        path.join(resolvedTargetDir, ".oxfmtrc.jsonc"),
    );
    copyPath(
        path.join(oxcSourceDir, "linting"),
        path.join(resolvedTargetDir, "oxc", "linting"),
    );

    updateOxcConfig(path.join(resolvedTargetDir, ".oxlintrc.jsonc"), {
        frontendSolid,
        simplelog,
        typebuddy,
    });
    updateOxfmtConfig(path.join(resolvedTargetDir, ".oxfmtrc.jsonc"));

    updatePackageScripts(packageJsonPath, {
        "format:oxc": "oxfmt -c ./.oxfmtrc.jsonc .",
        "format:oxc:check": "oxfmt -c ./.oxfmtrc.jsonc --check .",
        "lint:oxc": "oxlint -c ./.oxlintrc.jsonc --type-aware .",
    });

    installDevDependencies({
        targetDir: resolvedTargetDir,
        packageManager: resolvedPackageManager,
        packages: [
            "oxfmt",
            "oxlint",
            "oxlint-tsgolint@latest",
            ...(frontendSolid ? ["@murky-web/oxlint-plugin-solid"] : []),
        ],
        skipInstall,
    });

    return {
        packageManager: resolvedPackageManager,
        skipInstall,
        targetDir: resolvedTargetDir,
    };
}

function updateOxcConfig(configPath, { frontendSolid, simplelog, typebuddy }) {
    let next = readFileSync(configPath, "utf8");

    const desiredExtends = [
        ...BASE_EXTENDS,
        ...(typebuddy ? ["./oxc/linting/typebuddy.jsonc"] : []),
        ...(simplelog ? ["./oxc/linting/simplelog.jsonc"] : []),
        ...(frontendSolid ? ["./oxc/linting/solid.jsonc"] : []),
    ];

    next = next.replace(
        "../../../node_modules/oxlint/configuration_schema.json",
        "./node_modules/oxlint/configuration_schema.json",
    );

    next = next.replace(
        /"extends": \[[\s\S]*?\n\s*\],/u,
        `"extends": [\n${desiredExtends.map((entry) => `        "${entry}"`).join(",\n")}\n    ],`,
    );

    const jsPlugins = [];
    if (frontendSolid) {
        jsPlugins.push("@murky-web/oxlint-plugin-solid");
    }
    if (typebuddy) {
        jsPlugins.push("@murky-web/typebuddy/oxlint");
    }
    if (simplelog) {
        jsPlugins.push("@murky-web/simplelog/oxlint");
    }

    next = upsertJsPlugins(next, jsPlugins);

    writeFileSync(configPath, next);
}

function updateOxfmtConfig(configPath) {
    const next = readFileSync(configPath, "utf8").replace(
        "../../../node_modules/oxfmt/configuration_schema.json",
        "./node_modules/oxfmt/configuration_schema.json",
    );

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
