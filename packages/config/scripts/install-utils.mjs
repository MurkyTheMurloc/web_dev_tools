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
const LOCKFILE_TO_PACKAGE_MANAGER = [
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
];

function ensurePackageJson(targetDir) {
    const packageDir = resolvePackageDir(targetDir);
    const packageJsonPath = path.join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) {
        throw new Error(
            `Expected a package.json in ${targetDir} or one of its parent directories. Run the installer inside a project root or pass a target directory.`,
        );
    }

    return packageJsonPath;
}

function detectPackageManager(targetDir, explicitPackageManager) {
    if (explicitPackageManager) {
        if (!PACKAGE_MANAGERS.has(explicitPackageManager)) {
            throw new Error(
                `Unsupported package manager: ${explicitPackageManager}. Use bun, pnpm, npm, or yarn.`,
            );
        }

        return explicitPackageManager;
    }

    for (const currentDir of iterateAncestors(path.resolve(targetDir))) {
        const packageManager = readPackageManagerField(currentDir);
        if (packageManager) {
            return packageManager;
        }

        for (const [
            lockfile,
            detectedPackageManager,
        ] of LOCKFILE_TO_PACKAGE_MANAGER) {
            if (existsSync(path.join(currentDir, lockfile))) {
                return detectedPackageManager;
            }
        }
    }

    return "npm";
}

function resolvePackageDir(targetDir) {
    const resolvedTargetDir = path.resolve(targetDir);
    const nearestPackageDir = findNearestPackageDir(resolvedTargetDir);

    if (!nearestPackageDir) {
        throw new Error(
            `Expected a package.json in ${resolvedTargetDir} or one of its parent directories. Run the installer inside a project root or pass a target directory.`,
        );
    }

    return nearestPackageDir;
}

function resolveInstallContext(targetDir, explicitPackageManager) {
    const packageDir = resolvePackageDir(targetDir);
    const workspaceRoot = findWorkspaceRoot(packageDir) ?? packageDir;
    const packageManager = detectPackageManager(
        workspaceRoot,
        explicitPackageManager,
    );
    const workspaceRelativeDir =
        packageDir === workspaceRoot
            ? "."
            : path.relative(workspaceRoot, packageDir);
    const packageJson = JSON.parse(
        readFileSync(path.join(packageDir, "package.json"), "utf8"),
    );

    return {
        isWorkspacePackage: workspaceRoot !== packageDir,
        packageDir,
        packageManager,
        workspaceName:
            typeof packageJson.name === "string" ? packageJson.name : undefined,
        workspaceRelativeDir,
        workspaceRoot,
    };
}

function copyPath(sourcePath, targetPath) {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

function ensureGitignoreEntries(targetDir, entries) {
    const gitignorePath = path.join(targetDir, ".gitignore");
    const existing = existsSync(gitignorePath)
        ? readFileSync(gitignorePath, "utf8")
        : "";

    const normalizedEntries = entries
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (normalizedEntries.length === 0) {
        return;
    }

    const existingLines = new Set(
        existing
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean),
    );

    const missingEntries = normalizedEntries.filter((entry) => {
        return !existingLines.has(entry);
    });

    if (missingEntries.length === 0) {
        return;
    }

    const next =
        existing.endsWith("\n") || existing.length === 0
            ? existing
            : `${existing}\n`;

    writeFileSync(gitignorePath, `${next}${missingEntries.join("\n")}\n`);
}

function updatePackageScripts(packageJsonPath, scripts) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    packageJson.scripts ??= {};
    packageJson.scripts = {
        ...packageJson.scripts,
        ...scripts,
    };

    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function installDevDependencies({
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

function installDependencies({
    targetDir,
    packageManager,
    packages,
    skipInstall,
    dev = false,
}) {
    if (skipInstall || packages.length === 0) {
        return;
    }

    const installContext = resolveInstallContext(targetDir, packageManager);
    const commandMap = {
        bun: dev ? ["add", "-D"] : ["add"],
        pnpm: dev ? ["add", "-D"] : ["add"],
        npm: dev ? ["install", "-D"] : ["install"],
        yarn: dev ? ["add", "-D"] : ["add"],
    };

    const command = commandMap[installContext.packageManager];
    if (!command) {
        throw new Error(
            `Unsupported package manager: ${installContext.packageManager}.`,
        );
    }

    const runFromWorkspaceRoot =
        installContext.packageManager === "npm" &&
        installContext.isWorkspacePackage;
    const workspaceSelector =
        installContext.workspaceName ?? installContext.workspaceRelativeDir;
    const installArgs = runFromWorkspaceRoot
        ? [...command, "--workspace", workspaceSelector, ...packages]
        : [...command, ...packages];
    const result = spawnSync(installContext.packageManager, installArgs, {
        cwd: runFromWorkspaceRoot
            ? installContext.workspaceRoot
            : installContext.packageDir,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        throw new Error(
            `Dependency installation failed with ${installContext.packageManager}.`,
        );
    }
}

function findNearestPackageDir(startDir) {
    for (const currentDir of iterateAncestors(startDir)) {
        if (existsSync(path.join(currentDir, "package.json"))) {
            return currentDir;
        }
    }

    return undefined;
}

function findWorkspaceRoot(startDir) {
    let workspaceRoot;

    for (const currentDir of iterateAncestors(startDir)) {
        if (hasWorkspaceConfig(currentDir)) {
            workspaceRoot = currentDir;
        }
    }

    return workspaceRoot;
}

function hasWorkspaceConfig(directory) {
    if (existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
        return true;
    }

    const packageJsonPath = path.join(directory, "package.json");
    if (!existsSync(packageJsonPath)) {
        return false;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const { workspaces } = packageJson;

    if (Array.isArray(workspaces) && workspaces.length > 0) {
        return true;
    }

    return (
        typeof workspaces === "object" &&
        workspaces !== null &&
        Array.isArray(workspaces.packages) &&
        workspaces.packages.length > 0
    );
}

function readPackageManagerField(directory) {
    const packageJsonPath = path.join(directory, "package.json");
    if (!existsSync(packageJsonPath)) {
        return undefined;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof packageJson.packageManager !== "string") {
        return undefined;
    }

    const [packageManager] = packageJson.packageManager.split("@");
    return PACKAGE_MANAGERS.has(packageManager) ? packageManager : undefined;
}

function* iterateAncestors(startDir) {
    let currentDir = startDir;

    while (true) {
        yield currentDir;

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }

        currentDir = parentDir;
    }
}

export {
    copyPath,
    detectPackageManager,
    ensureGitignoreEntries,
    ensurePackageJson,
    installDependencies,
    installDevDependencies,
    resolveInstallContext,
    resolvePackageDir,
    updatePackageScripts,
};
