#!/usr/bin/env bun

import path from "node:path";
import process from "node:process";

import { installBiomeConfig } from "../scripts/install-biome-config.mjs";
import { installOxcConfig } from "../scripts/install-oxc-config.mjs";
import { installTypeScriptConfig } from "../scripts/install-typescript-config.mjs";

function printUsage() {
    console.log(`Usage:
  web-dev-config init [--oxc | --biome] [--typescript] [--frontend-solid] [target-dir] [--skip-install] [--package-manager <pm>]

Options:
  --oxc                 Install the modular Oxc config
  --biome               Install the Biome config
  --typescript          Install the TypeScript config
  --frontend-solid      Apply Solid frontend presets to selected configs
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
    let useOxc = false;
    let useTypeScript = false;
    let frontendSolid = false;
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

        if (argument === "--typescript") {
            useTypeScript = true;
            continue;
        }

        if (argument === "--frontend-solid") {
            frontendSolid = true;
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

    if (!useOxc && !useBiome && !useTypeScript) {
        fail("Select at least one install target: --oxc, --biome, or --typescript.");
    }

    if (frontendSolid && !useOxc && !useBiome && !useTypeScript) {
        fail("--frontend-solid needs at least one install target.");
    }

    return {
        frontendSolid,
        packageManager,
        skipInstall,
        targetDir,
        useBiome,
        useOxc,
        useTypeScript,
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const results = [];

    if (options.useOxc) {
        results.push(
            await installOxcConfig({
                frontendSolid: options.frontendSolid,
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
                packageManager: options.packageManager,
                skipInstall: options.skipInstall,
                targetDir: options.targetDir,
            }),
        );
    }

    const installed = [
        options.useOxc ? "oxc" : null,
        options.useBiome ? "biome" : null,
        options.useTypeScript ? "typescript" : null,
        options.frontendSolid ? "frontend-solid" : null,
    ].filter(Boolean);

    console.log(`Installed ${installed.join(", ")} in ${options.targetDir}`);
    console.log(`Package manager: ${results[0]?.packageManager ?? "npm"}`);
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
