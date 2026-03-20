---
name: git-guardrails-claude-code
description:
    Set up Claude Code hooks to block dangerous git commands like push, reset
    --hard, clean, or branch -D before they execute. Use when the user wants git
    safety guardrails in Claude Code.
---

# Git Guardrails For Claude Code

Set up a Claude Code `PreToolUse` hook that blocks dangerous git commands before
Claude executes them.

## What Gets Blocked

- `git push`, including force variants
- `git reset --hard`
- `git clean -f` and `git clean -fd`
- `git branch -D`
- `git checkout .`
- `git restore .`

When blocked, Claude sees a message explaining that it does not have authority
to run the command.

## Setup Flow

### 1. Choose the scope

Ask whether the user wants the guardrails installed for:

- this project only via `.claude/settings.json`
- all projects via `~/.claude/settings.json`

### 2. Copy the bundled hook script

Use the bundled script at
[scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh).

Copy it to:

- project scope: `.claude/hooks/block-dangerous-git.sh`
- global scope: `~/.claude/hooks/block-dangerous-git.sh`

Then make it executable with `chmod +x`.

### 3. Add the hook to Claude settings

Project settings shape:

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
                    }
                ]
            }
        ]
    }
}
```

Global settings shape:

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/block-dangerous-git.sh"
                    }
                ]
            }
        ]
    }
}
```

If the settings file already exists, merge into the existing `hooks.PreToolUse`
array. Do not overwrite unrelated settings.

### 4. Offer customization

Ask whether the user wants to add or remove blocked patterns. If yes, adjust the
copied script instead of changing the bundled source in place unless they
explicitly want the skill updated too.

### 5. Verify

Run a quick test by piping a fake Claude tool payload into the installed hook:

```bash
printf '%s\n' '{"tool_input":{"command":"git push origin main"}}' | ./.claude/hooks/block-dangerous-git.sh
```

Expected result:

- exit code `2`
- `BLOCKED` message on stderr
