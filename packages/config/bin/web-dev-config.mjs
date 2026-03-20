#!/usr/bin/env bun

import path from "node:path";
import process from "node:process";

import { installBiomeConfig } from "../scripts/install-biome-config.mjs";
import { installOxcConfig } from "../scripts/install-oxc-config.mjs";
import { installTypeScriptConfig } from "../scripts/install-typescript-config.mjs";
import {
    detectPackageManager,
    installDependencies,
} from "../scripts/install-utils.mjs";

const DEFAULT_FEATURES = {
    frontendSolid: true,
    installSimplelog: true,
    installTypebuddy: true,
    useOxc: true,
    useTypeScript: true,
};

function printUsage() {
    console.log(`Usage:
  web-dev-config init [--defaults] [--oxc | --biome] [--typescript] [--frontend-solid] [--typebuddy] [--simplelog] [target-dir] [--skip-install] [--package-manager <pm>]

Options:
  --defaults            Install the default setup: --oxc --typescript --frontend-solid --typebuddy --simplelog
  --oxc                 Install the modular Oxc config
  --biome               Install the Biome config
  --typescript          Install the TypeScript config
  --frontend-solid      Apply Solid frontend presets to selected configs
  --typebuddy           Install @murky-web/typebuddy and wire its config defaults
  --simplelog           Install @murky-web/simplelog
  --skip-install        Skip dependency installation
  --package-manager     Force bun, pnpm, npm, or yarn
  -h, --help            Show this help
`);
}

function fail(message) {
    console.error(message);
    console.error("");
    printUsage();
    process.exit(1);
}

function parseArgs(argv) {
    if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
        printUsage();
        process.exit(0);
    }

    const [command, ...rest] = argv;
    if (command !== "init") {
        fail(`Unknown command: ${command}`);
    }

    let useBiome = false;
    let useDefaults = false;
    let useOxc = false;
    let useTypeScript = false;
    let frontendSolid = false;
    let installTypebuddy = false;
    let installSimplelog = false;
    let skipInstall = false;
    let packageManager;
    let targetDir = process.cwd();
    let positionalTargetSeen = false;

    for (let index = 0; index < rest.length; index += 1) {
        const argument = rest[index];

        if (argument === "--oxc") {
            if (useBiome) {
                fail("Use at most one of --oxc or --biome.");
            }

            useOxc = true;
            continue;
        }

        if (argument === "--biome") {
            if (useOxc) {
                fail("Use at most one of --oxc or --biome.");
            }

            useBiome = true;
            continue;
        }

        if (argument === "--defaults") {
            useDefaults = true;
            continue;
        }

        if (argument === "--typescript") {
            useTypeScript = true;
            continue;
        }

        if (argument === "--frontend-solid") {
            frontendSolid = true;
            continue;
        }

        if (argument === "--typebuddy") {
            installTypebuddy = true;
            continue;
        }

        if (argument === "--simplelog") {
            installSimplelog = true;
            continue;
        }

        if (argument === "--skip-install") {
            skipInstall = true;
            continue;
        }

        if (argument === "--package-manager") {
            const value = rest[index + 1];
            if (!value) {
                fail("Missing value after --package-manager.");
            }

            packageManager = value;
            index += 1;
            continue;
        }

        if (argument.startsWith("--package-manager=")) {
            packageManager = argument.slice("--package-manager=".length);
            if (!packageManager) {
                fail("Missing value after --package-manager=.");
            }
            continue;
        }

        if (argument.startsWith("-")) {
            fail(`Unknown option: ${argument}`);
        }

        if (positionalTargetSeen) {
            fail("Only one positional target directory is supported.");
        }

        targetDir = path.resolve(argument);
        positionalTargetSeen = true;
    }

    if (
        useDefaults ||
        noExplicitInstallTargetsSelected({
            installSimplelog,
            installTypebuddy,
            useBiome,
            useOxc,
            useTypeScript,
        })
    ) {
        frontendSolid = DEFAULT_FEATURES.frontendSolid;
        installSimplelog = DEFAULT_FEATURES.installSimplelog;
        installTypebuddy = DEFAULT_FEATURES.installTypebuddy;
        useOxc = DEFAULT_FEATURES.useOxc;
        useTypeScript = DEFAULT_FEATURES.useTypeScript;
    }

    if (useBiome && useOxc) {
        fail("Use at most one of --oxc or --biome.");
    }

    if (frontendSolid && !useOxc && !useBiome && !useTypeScript) {
        fail("--frontend-solid needs at least one install target.");
    }

    return {
        frontendSolid,
        installSimplelog,
        installTypebuddy,
        packageManager,
        skipInstall,
        targetDir,
        useBiome,
        useOxc,
        useTypeScript,
    };
}

function noExplicitInstallTargetsSelected({
    installSimplelog,
    installTypebuddy,
    useBiome,
    useOxc,
    useTypeScript,
}) {
    return (
        !useOxc &&
        !useBiome &&
        !useTypeScript &&
        !installTypebuddy &&
        !installSimplelog
    );
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const results = [];
    const resolvedPackageManager = detectPackageManager(
        options.targetDir,
        options.packageManager,
    );

    if (options.useOxc) {
        results.push(
            await installOxcConfig({
                frontendSolid: options.frontendSolid,
                typebuddy: options.installTypebuddy,
                packageManager: options.packageManager,
                skipInstall: options.skipInstall,
                targetDir: options.targetDir,
            }),
        );
    }

    if (options.useBiome) {
        results.push(
            await installBiomeConfig({
                frontendSolid: options.frontendSolid,
                packageManager: options.packageManager,
                skipInstall: options.skipInstall,
                targetDir: options.targetDir,
            }),
        );
    }

    if (options.useTypeScript) {
        results.push(
            await installTypeScriptConfig({
                frontendSolid: options.frontendSolid,
                typebuddy: options.installTypebuddy,
                packageManager: options.packageManager,
                skipInstall: options.skipInstall,
                targetDir: options.targetDir,
            }),
        );
    }

    installDependencies({
        packageManager: resolvedPackageManager,
        packages: [
            ...(options.installTypebuddy ? ["@murky-web/typebuddy"] : []),
            ...(options.installSimplelog ? ["@murky-web/simplelog"] : []),
        ],
        skipInstall: options.skipInstall,
        targetDir: options.targetDir,
    });

    const installed = [
        options.useOxc ? "oxc" : null,
        options.useBiome ? "biome" : null,
        options.useTypeScript ? "typescript" : null,
        options.frontendSolid ? "frontend-solid" : null,
        options.installTypebuddy ? "typebuddy" : null,
        options.installSimplelog ? "simplelog" : null,
    ].filter(Boolean);

    console.log(`Installed ${installed.join(", ")} in ${options.targetDir}`);
    console.log(
        `Package manager: ${results[0]?.packageManager ?? resolvedPackageManager}`,
    );
    console.log(
        options.skipInstall
            ? "Dependency installation was skipped."
            : "Dependencies were installed.",
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
