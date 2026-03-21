import { existsSync, rmSync } from "node:fs";
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
const typescriptSourceDir = path.join(repoRoot, "typescript");

export async function installTypeScriptConfig({
    frontendSolid = false,
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
        path.join(typescriptSourceDir, "tsconfig.base.jsonc"),
        path.join(resolvedTargetDir, "tsconfig.base.jsonc"),
    );

    copyPath(
        path.join(
            typescriptSourceDir,
            resolveTsconfigTemplate({
                frontendSolid,
                typebuddy,
            }),
        ),
        path.join(resolvedTargetDir, "tsconfig.json"),
    );

    syncTypebuddyGlobalsShim({
        targetDir: resolvedTargetDir,
        typebuddy,
    });

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

function resolveTsconfigTemplate({ frontendSolid, typebuddy }) {
    if (frontendSolid && typebuddy) {
        return "tsconfig.solid.typebuddy.jsonc";
    }

    if (frontendSolid) {
        return "tsconfig.solid.jsonc";
    }

    if (typebuddy) {
        return "tsconfig.typebuddy.jsonc";
    }

    return "tsconfig.base.jsonc";
}

function removeLegacyTypeScriptConfigs(targetDir) {
    for (const filename of ["tsconfig.app.json", "tsconfig.node.json"]) {
        const filePath = path.join(targetDir, filename);
        if (existsSync(filePath)) {
            rmSync(filePath);
        }
    }
}

function syncTypebuddyGlobalsShim({ targetDir, typebuddy }) {
    const shimPath = path.join(targetDir, "typebuddy-globals.d.ts");

    if (typebuddy) {
        copyPath(
            path.join(typescriptSourceDir, "typebuddy-globals.d.ts"),
            shimPath,
        );
        return;
    }

    if (existsSync(shimPath)) {
        rmSync(shimPath);
    }
}
