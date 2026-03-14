import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    copyPath,
    detectPackageManager,
    ensurePackageJson,
    installDevDependencies,
    updatePackageScripts,
} from "./install-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const oxcSourceDir = path.join(repoRoot, "oxc");

export async function installOxcConfig({
    frontendSolid = false,
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
        enableSolidInOxcConfig(
            path.join(resolvedTargetDir, "oxc", ".oxlintrc.jsonc"),
        );
    }

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
            ...(frontendSolid ? ["eslint-plugin-solid"] : []),
        ],
        skipInstall,
    });

    return {
        packageManager: resolvedPackageManager,
        skipInstall,
        targetDir: resolvedTargetDir,
    };
}

function enableSolidInOxcConfig(configPath) {
    const source = readFileSync(configPath, "utf8");

    let next = source;
    if (!next.includes(`"./linting/solid.jsonc"`)) {
        const extendsMarker = `        "./linting/jsdoc.jsonc"\n    ],`;
        if (!next.includes(extendsMarker)) {
            throw new Error(
                "Could not enable Solid support in .oxlintrc.jsonc: expected extends marker not found.",
            );
        }

        next = next.replace(
            extendsMarker,
            `        "./linting/jsdoc.jsonc",\n        "./linting/solid.jsonc"\n    ],`,
        );
    }

    if (!next.includes(`"jsPlugins": [`)) {
        const pluginMarker = `    "plugins": [`;
        if (!next.includes(pluginMarker)) {
            throw new Error(
                "Could not enable Solid support in .oxlintrc.jsonc: expected plugins marker not found.",
            );
        }

        next = next.replace(
            pluginMarker,
            `    "jsPlugins": [\n        "eslint-plugin-solid"\n    ],\n    "plugins": [`,
        );
    }

    writeFileSync(configPath, next);
}
