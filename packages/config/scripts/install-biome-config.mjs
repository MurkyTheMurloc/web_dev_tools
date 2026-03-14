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
const biomeSourceDir = path.join(repoRoot, "biome");

export async function installBiomeConfig({
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

    copyPath(biomeSourceDir, path.join(resolvedTargetDir, "biome"));
    if (frontendSolid) {
        enableSolidInBiomeConfig(
            path.join(resolvedTargetDir, "biome", "biome.jsonc"),
        );
    }

    updatePackageScripts(packageJsonPath, {
        "check:biome": "biome check --config-path ./biome/biome.jsonc .",
        "format:biome":
            "biome format --config-path ./biome/biome.jsonc --write .",
        "lint:biome": "biome lint --config-path ./biome/biome.jsonc .",
    });

    installDevDependencies({
        targetDir: resolvedTargetDir,
        packageManager: resolvedPackageManager,
        packages: ["@biomejs/biome"],
        skipInstall,
    });

    return {
        packageManager: resolvedPackageManager,
        skipInstall,
        targetDir: resolvedTargetDir,
    };
}

function enableSolidInBiomeConfig(configPath) {
    const source = readFileSync(configPath, "utf8");
    const marker = `"enabled": true,\n        "rules": {`;

    if (source.includes(`"solid": "all"`)) {
        return;
    }

    if (!source.includes(marker)) {
        throw new Error(
            "Could not enable Solid support in biome.jsonc: expected linter marker not found.",
        );
    }

    const next = source.replace(
        marker,
        `"enabled": true,\n        "domains": {\n            "solid": "all"\n        },\n        "rules": {`,
    );

    writeFileSync(configPath, next);
}
