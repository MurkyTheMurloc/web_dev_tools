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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const oxcSourceDir = path.join(repoRoot, "oxc");
const require = createRequire(import.meta.url);

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
        const solidJsPluginSourceDir = resolveSolidJsPluginSourceDir();
        copyPath(
            solidJsPluginSourceDir,
            path.join(resolvedTargetDir, "oxc", "jsplugins", "solid"),
        );
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
            ...(frontendSolid
                ? [
                      "@typescript-eslint/utils",
                      "eslint",
                      "estraverse",
                      "is-html",
                      "kebab-case",
                      "known-css-properties",
                      "style-to-object",
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
            `    "jsPlugins": [\n        "./jsplugins/solid/index.mjs"\n    ],\n    "plugins": [`,
        );
    }

    if (!next.includes(`"./jsplugins/**"`)) {
        if (next.includes(`"ignorePatterns": [`)) {
            next = next.replace(
                `"ignorePatterns": [`,
                `"ignorePatterns": [\n        "./jsplugins/**",`,
            );
        } else {
            const extendsBlockEnd = `    ],\n`;
            const extendsIndex = next.indexOf(extendsBlockEnd);
            if (extendsIndex === -1) {
                throw new Error(
                    "Could not enable Solid support in .oxlintrc.jsonc: expected extends block not found.",
                );
            }

            next = `${next.slice(0, extendsIndex + extendsBlockEnd.length)}    "ignorePatterns": [\n        "./jsplugins/**"\n    ],\n${next.slice(extendsIndex + extendsBlockEnd.length)}`;
        }
    }

    writeFileSync(configPath, next);
}
