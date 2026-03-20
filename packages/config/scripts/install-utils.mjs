import { spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import path from "node:path";

const PACKAGE_MANAGERS = new Set(["bun", "pnpm", "npm", "yarn"]);

export function ensurePackageJson(targetDir) {
    const packageJsonPath = path.join(targetDir, "package.json");
    if (!existsSync(packageJsonPath)) {
        throw new Error(
            `Expected a package.json in ${targetDir}. Run the installer inside a project root or pass a target directory.`,
        );
    }

    return packageJsonPath;
}

export function detectPackageManager(targetDir, explicitPackageManager) {
    if (explicitPackageManager) {
        if (!PACKAGE_MANAGERS.has(explicitPackageManager)) {
            throw new Error(
                `Unsupported package manager: ${explicitPackageManager}. Use bun, pnpm, npm, or yarn.`,
            );
        }

        return explicitPackageManager;
    }

    const lockfileChecks = [
        ["bun.lock", "bun"],
        ["bun.lockb", "bun"],
        ["pnpm-lock.yaml", "pnpm"],
        ["yarn.lock", "yarn"],
        ["package-lock.json", "npm"],
    ];

    for (const [lockfile, packageManager] of lockfileChecks) {
        if (existsSync(path.join(targetDir, lockfile))) {
            return packageManager;
        }
    }

    return "npm";
}

export function copyPath(sourcePath, targetPath) {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

export function updatePackageScripts(packageJsonPath, scripts) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    packageJson.scripts = {
        ...(packageJson.scripts ?? {}),
        ...scripts,
    };

    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export function installDevDependencies({
    targetDir,
    packageManager,
    packages,
    skipInstall,
}) {
    installDependencies({
        dev: true,
        packageManager,
        packages,
        skipInstall,
        targetDir,
    });
}

export function installDependencies({
    targetDir,
    packageManager,
    packages,
    skipInstall,
    dev = false,
}) {
    if (skipInstall || packages.length === 0) {
        return;
    }

    const commandMap = {
        bun: dev ? ["add", "-D"] : ["add"],
        pnpm: dev ? ["add", "-D"] : ["add"],
        npm: dev ? ["install", "-D"] : ["install"],
        yarn: dev ? ["add", "-D"] : ["add"],
    };

    const command = commandMap[packageManager];
    if (!command) {
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }

    const result = spawnSync(packageManager, [...command, ...packages], {
        cwd: targetDir,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        throw new Error(
            `Dependency installation failed with ${packageManager}.`,
        );
    }
}
