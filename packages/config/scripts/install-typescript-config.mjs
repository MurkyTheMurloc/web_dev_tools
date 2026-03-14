import path from "node:path";
import { existsSync, rmSync } from "node:fs";
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
const typescriptSourceDir = path.join(repoRoot, "typescript");

export async function installTypeScriptConfig({
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
        path.join(typescriptSourceDir, "tsconfig.base.jsonc"),
        path.join(resolvedTargetDir, "tsconfig.base.jsonc"),
    );

    copyPath(
        path.join(
            typescriptSourceDir,
            frontendSolid ? "tsconfig.solid.jsonc" : "tsconfig.base.jsonc",
        ),
        path.join(resolvedTargetDir, "tsconfig.json"),
    );

    removeLegacyTypeScriptConfigs(resolvedTargetDir);

    updatePackageScripts(packageJsonPath, {
        typecheck: "tsgo --project ./tsconfig.json --noEmit",
    });

    installDevDependencies({
        targetDir: resolvedTargetDir,
        packageManager: resolvedPackageManager,
        packages: ["@typescript/native-preview"],
        skipInstall,
    });

    return {
        packageManager: resolvedPackageManager,
        skipInstall,
        targetDir: resolvedTargetDir,
    };
}

function removeLegacyTypeScriptConfigs(targetDir) {
    for (const filename of ["tsconfig.app.json", "tsconfig.node.json"]) {
        const filePath = path.join(targetDir, filename);
        if (existsSync(filePath)) {
            rmSync(filePath);
        }
    }
}
