import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { copyPath } from "./install-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const skillSourceDir = path.join(
    repoRoot,
    ".codex",
    "skills",
    "git-guardrails-claude-code",
);

export function installGitGuardrailsClaudeCodeSkill({
    targetDir = process.cwd(),
} = {}) {
    const resolvedTargetDir = path.resolve(targetDir);

    copyPath(
        skillSourceDir,
        path.join(
            resolvedTargetDir,
            ".codex",
            "skills",
            "git-guardrails-claude-code",
        ),
    );

    return {
        targetDir: resolvedTargetDir,
    };
}
