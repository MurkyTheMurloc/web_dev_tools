---
name: workspace-defaults
description:
    Repository-local default workflow rules for delivery quality. Use when
    working in this project to enforce linting and formatting checks after each
    completed work package and to avoid rule-disabling as a shortcut.
---

# Workspace Defaults

Use this skill as the local default workflow for implementation work in this
project.

## Required Quality Loop

After each completed work package:

1. Run the relevant formatting check or formatter.
2. Run the relevant lint check.
3. Run any directly affected verification step such as typecheck, tests, or
   build when appropriate.
4. Do not consider the work package done while these checks are knowingly red
   without explicitly calling that out.

## Rule Integrity

For linting and formatting fixes:

- never treat disabling a rule as the default solution
- never lower or switch off a rule just to get green output
- prefer changing the code to satisfy the rule
- if a rule is genuinely wrong for the project, change the shared
  source-of-truth config intentionally and explicitly, not as an ad hoc local
  bypass

## Practical Guidance

- Use fixers when they preserve the intended rule set.
- Re-run checks after auto-fixes.
- If a task only changes documentation or non-code assets, say that no code
  quality checks were necessary.
