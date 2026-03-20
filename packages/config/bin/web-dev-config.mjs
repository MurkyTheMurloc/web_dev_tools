#!/usr/bin/env bun

import path from "node:path";
import process from "node:process";

import { installBiomeConfig } from "../scripts/install-biome-config.mjs";
import { installContext7DefaultsSkill } from "../scripts/install-context7-defaults-skill.mjs";
import { installFindDocsSkill } from "../scripts/install-find-docs-skill.mjs";
import { installFrontendDesignSkill } from "../scripts/install-frontend-design-skill.mjs";
import { installFrontendTasteSkill } from "../scripts/install-frontend-taste-skill.mjs";
import { installGitGuardrailsClaudeCodeSkill } from "../scripts/install-git-guardrails-claude-code-skill.mjs";
import { installGrillMeSkill } from "../scripts/install-grill-me-skill.mjs";
import { installImproveCodebaseArchitectureSkill } from "../scripts/install-improve-codebase-architecture-skill.mjs";
import { installOxcConfig } from "../scripts/install-oxc-config.mjs";
import { installSimplelogSkill } from "../scripts/install-simplelog-skill.mjs";
import { installSolidjsSkill } from "../scripts/install-solidjs-skill.mjs";
import { installTailwindcssSkill } from "../scripts/install-tailwindcss-skill.mjs";
import { installTddSkill } from "../scripts/install-tdd-skill.mjs";
import { installTypebuddySkill } from "../scripts/install-typebuddy-skill.mjs";
import { installTypeScriptConfig } from "../scripts/install-typescript-config.mjs";
import { installUbiquitousLanguageSkill } from "../scripts/install-ubiquitous-language-skill.mjs";
import {
    detectPackageManager,
    ensureGitignoreEntries,
    installDependencies,
} from "../scripts/install-utils.mjs";
import { installWorkspaceDefaultsSkill } from "../scripts/install-workspace-defaults-skill.mjs";

const DEFAULT_FEATURES = {
    frontendSolid: true,
    installSimplelog: true,
    installTypebuddy: true,
    useOxc: true,
    useSkillContext7Defaults: true,
    useSkillFindDocs: true,
    useSkillFrontendDesign: true,
    useSkillFrontendTaste: true,
    useSkillSimplelog: true,
    useSkillSolidjs: true,
    useSkillTailwindcss: true,
    useSkillTdd: true,
    useSkillTypebuddy: true,
    useSkillWorkspaceDefaults: true,
    useTypeScript: true,
};

function printUsage() {
    console.log(`Usage:
  web-dev-config init [--defaults] [--oxc | --biome] [--typescript] [--frontend-solid] [--typebuddy] [--simplelog] [--skill-context7-defaults] [--skill-find-docs] [--skill-frontend-design] [--skill-frontend-taste] [--skill-workspace-defaults] [--skill-grill-me] [--skill-improve-codebase-architecture] [--skill-simplelog] [--skill-solidjs] [--skill-tailwindcss] [--skill-tdd] [--skill-typebuddy] [--skill-ubiquitous-language] [--skill-git-guardrails-claude-code] [target-dir] [--skip-install] [--package-manager <pm>]

Options:
  --defaults            Install the default stack: --oxc --typescript --frontend-solid --typebuddy --simplelog plus the default skills
  --oxc                 Install the modular Oxc config
  --biome               Install the Biome config
  --typescript          Install the TypeScript config
  --frontend-solid      Apply Solid frontend presets to selected configs
  --typebuddy           Install @murky-web/typebuddy and wire its config defaults
  --simplelog           Install @murky-web/simplelog and wire its Oxc preset when Oxc is enabled
  --skill-context7-defaults
                        Install the local Context7 defaults skill
  --skill-find-docs     Install the local find-docs skill
  --skill-frontend-design
                        Install the local frontend-design skill
  --skill-frontend-taste
                        Install the local frontend-taste skill
  --skill-workspace-defaults
                        Install the local workspace-defaults skill
  --skill-grill-me      Install the local grill-me skill
  --skill-git-guardrails-claude-code
                        Install the local git-guardrails-claude-code skill
  --skill-improve-codebase-architecture
                        Install the local improve-codebase-architecture skill
  --skill-simplelog     Install the local simplelog skill
  --skill-solidjs       Install the local solidjs skill
  --skill-tailwindcss   Install the local tailwindcss skill
  --skill-tdd           Install the local tdd skill
  --skill-typebuddy     Install the local typebuddy skill
  --skill-ubiquitous-language
                        Install the local ubiquitous-language skill
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
    let useSkillContext7Defaults = false;
    let useSkillFindDocs = false;
    let useSkillFrontendDesign = false;
    let useSkillFrontendTaste = false;
    let useSkillGitGuardrailsClaudeCode = false;
    let useSkillGrillMe = false;
    let useSkillImproveCodebaseArchitecture = false;
    let useSkillSimplelog = false;
    let useSkillSolidjs = false;
    let useSkillTailwindcss = false;
    let useSkillTdd = false;
    let useSkillTypebuddy = false;
    let useSkillUbiquitousLanguage = false;
    let useSkillWorkspaceDefaults = false;
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

        if (argument === "--skill-context7-defaults") {
            useSkillContext7Defaults = true;
            continue;
        }

        if (argument === "--skill-find-docs") {
            useSkillFindDocs = true;
            continue;
        }

        if (argument === "--skill-frontend-design") {
            useSkillFrontendDesign = true;
            continue;
        }

        if (argument === "--skill-frontend-taste") {
            useSkillFrontendTaste = true;
            continue;
        }

        if (argument === "--skill-workspace-defaults") {
            useSkillWorkspaceDefaults = true;
            continue;
        }

        if (argument === "--skill-grill-me") {
            useSkillGrillMe = true;
            continue;
        }

        if (argument === "--skill-git-guardrails-claude-code") {
            useSkillGitGuardrailsClaudeCode = true;
            continue;
        }

        if (argument === "--skill-improve-codebase-architecture") {
            useSkillImproveCodebaseArchitecture = true;
            continue;
        }

        if (argument === "--skill-simplelog") {
            useSkillSimplelog = true;
            continue;
        }

        if (argument === "--skill-solidjs") {
            useSkillSolidjs = true;
            continue;
        }

        if (argument === "--skill-tailwindcss") {
            useSkillTailwindcss = true;
            continue;
        }

        if (argument === "--skill-tdd") {
            useSkillTdd = true;
            continue;
        }

        if (argument === "--skill-typebuddy") {
            useSkillTypebuddy = true;
            continue;
        }

        if (argument === "--skill-ubiquitous-language") {
            useSkillUbiquitousLanguage = true;
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

    const noExplicitInstallTargets =
        !useOxc &&
        !useBiome &&
        !useTypeScript &&
        !installTypebuddy &&
        !installSimplelog &&
        !useSkillContext7Defaults &&
        !useSkillFindDocs &&
        !useSkillFrontendDesign &&
        !useSkillFrontendTaste &&
        !useSkillGitGuardrailsClaudeCode &&
        !useSkillGrillMe &&
        !useSkillImproveCodebaseArchitecture &&
        !useSkillSimplelog &&
        !useSkillSolidjs &&
        !useSkillTailwindcss &&
        !useSkillTdd &&
        !useSkillTypebuddy &&
        !useSkillUbiquitousLanguage &&
        !useSkillWorkspaceDefaults;

    let usedDefaultStack = false;

    if (useDefaults || noExplicitInstallTargets) {
        frontendSolid = true;
        installSimplelog = true;
        installTypebuddy = true;
        useOxc = true;
        useTypeScript = true;
        useSkillContext7Defaults = true;
        useSkillFindDocs = true;
        useSkillFrontendDesign = true;
        useSkillFrontendTaste = true;
        useSkillSimplelog = true;
        useSkillSolidjs = true;
        useSkillTailwindcss = true;
        useSkillTdd = true;
        useSkillTypebuddy = true;
        useSkillWorkspaceDefaults = true;
        usedDefaultStack = true;
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
        usedDefaultStack,
        useBiome,
        useOxc,
        useSkillContext7Defaults,
        useSkillFindDocs,
        useSkillFrontendDesign,
        useSkillFrontendTaste,
        useSkillGitGuardrailsClaudeCode,
        useSkillGrillMe,
        useSkillImproveCodebaseArchitecture,
        useSkillSimplelog,
        useSkillSolidjs,
        useSkillTailwindcss,
        useSkillTdd,
        useSkillTypebuddy,
        useSkillUbiquitousLanguage,
        useSkillWorkspaceDefaults,
        useTypeScript,
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const results = [];
    const resolvedPackageManager = detectPackageManager(
        options.targetDir,
        options.packageManager,
    );
    const installsSkills =
        options.useSkillContext7Defaults ||
        options.useSkillFindDocs ||
        options.useSkillFrontendDesign ||
        options.useSkillFrontendTaste ||
        options.useSkillGitGuardrailsClaudeCode ||
        options.useSkillGrillMe ||
        options.useSkillImproveCodebaseArchitecture ||
        options.useSkillSimplelog ||
        options.useSkillSolidjs ||
        options.useSkillTailwindcss ||
        options.useSkillTdd ||
        options.useSkillTypebuddy ||
        options.useSkillUbiquitousLanguage ||
        options.useSkillWorkspaceDefaults;

    if (options.useOxc) {
        results.push(
            await installOxcConfig({
                frontendSolid: options.frontendSolid,
                simplelog: options.installSimplelog,
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

    if (options.useSkillContext7Defaults) {
        results.push(
            installContext7DefaultsSkill({ targetDir: options.targetDir }),
        );
    }

    if (options.useSkillFindDocs) {
        results.push(installFindDocsSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillFrontendDesign) {
        results.push(
            installFrontendDesignSkill({ targetDir: options.targetDir }),
        );
    }

    if (options.useSkillFrontendTaste) {
        results.push(
            installFrontendTasteSkill({ targetDir: options.targetDir }),
        );
    }

    if (options.useSkillWorkspaceDefaults) {
        results.push(
            installWorkspaceDefaultsSkill({ targetDir: options.targetDir }),
        );
    }

    if (options.useSkillGrillMe) {
        results.push(installGrillMeSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillGitGuardrailsClaudeCode) {
        results.push(
            installGitGuardrailsClaudeCodeSkill({
                targetDir: options.targetDir,
            }),
        );
    }

    if (options.useSkillImproveCodebaseArchitecture) {
        results.push(
            installImproveCodebaseArchitectureSkill({
                targetDir: options.targetDir,
            }),
        );
    }

    if (options.useSkillSimplelog) {
        results.push(installSimplelogSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillSolidjs) {
        results.push(installSolidjsSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillTailwindcss) {
        results.push(installTailwindcssSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillTdd) {
        results.push(installTddSkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillTypebuddy) {
        results.push(installTypebuddySkill({ targetDir: options.targetDir }));
    }

    if (options.useSkillUbiquitousLanguage) {
        results.push(
            installUbiquitousLanguageSkill({ targetDir: options.targetDir }),
        );
    }

    if (installsSkills) {
        ensureGitignoreEntries(options.targetDir, [
            ".codex/skills/",
            ".skills/",
        ]);
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
        options.installTypebuddy ? "typebuddy" : null,
        options.installSimplelog ? "simplelog" : null,
        options.useSkillContext7Defaults ? "skill-context7-defaults" : null,
        options.useSkillFindDocs ? "skill-find-docs" : null,
        options.useSkillFrontendDesign ? "skill-frontend-design" : null,
        options.useSkillFrontendTaste ? "skill-frontend-taste" : null,
        options.useSkillGitGuardrailsClaudeCode
            ? "skill-git-guardrails-claude-code"
            : null,
        options.useSkillGrillMe ? "skill-grill-me" : null,
        options.useSkillImproveCodebaseArchitecture
            ? "skill-improve-codebase-architecture"
            : null,
        options.useSkillSimplelog ? "skill-simplelog" : null,
        options.useSkillSolidjs ? "skill-solidjs" : null,
        options.useSkillTailwindcss ? "skill-tailwindcss" : null,
        options.useSkillTdd ? "skill-tdd" : null,
        options.useSkillTypebuddy ? "skill-typebuddy" : null,
        options.useSkillUbiquitousLanguage ? "skill-ubiquitous-language" : null,
        options.useSkillWorkspaceDefaults ? "skill-workspace-defaults" : null,
        options.frontendSolid ? "frontend-solid" : null,
    ].filter(Boolean);

    const packageManagerUsed =
        results.find((result) => {
            return typeof result?.packageManager === "string";
        })?.packageManager ??
        (options.installTypebuddy || options.installSimplelog
            ? resolvedPackageManager
            : undefined);
    const installedDependencies =
        options.installTypebuddy || options.installSimplelog;

    console.log(
        `${options.usedDefaultStack ? "Installed default stack" : "Installed"} ${installed.join(", ")} in ${options.targetDir}`,
    );
    console.log(`Package manager: ${packageManagerUsed ?? "not used"}`);
    console.log(
        !installedDependencies
            ? "No package dependencies were installed."
            : options.skipInstall
              ? "Dependency installation was skipped."
              : "Dependencies were installed.",
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
