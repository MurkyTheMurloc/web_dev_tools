# Codex Best Practices

## What matters for Codex

The documented Codex setup for `context-mode` is:

- install `context-mode` globally
- register it in `~/.codex/config.toml`
- restart Codex
- rely on `AGENTS.md` routing instructions

Unlike Claude Code or some editor integrations, Codex does not support hooks
for `context-mode`. There is no automatic interception layer for raw-output
tool usage.

## Practical implication

Use `context-mode` intentionally:

- choose sandbox, index, and search tools before raw-output tools when
  exploring
- avoid repeated uncompressed reads when you only need summaries or matches
- use direct reads for editing, not broad investigation

## Good patterns

### Explore many files or commands

Use `ctx_batch_execute`.

Why:

- one tool call instead of many
- lower context overhead
- better for wide investigation passes

### Inspect a noisy file without dumping it into context

Use `ctx_execute_file`.

Why:

- raw file content stays out of context
- better for extraction, summarization, and scanning

### Work with docs, logs, markdown, or fetched pages

Use `ctx_index` or `ctx_fetch_and_index`, then `ctx_search`.

Why:

- index once
- retrieve only relevant slices
- avoid repeated giant payloads

### Edit a file

Read it directly when needed.

Why:

- editing requires exact content in context
- `context-mode` is better for exploration than patching workflows

## Decision rule

Ask this before using a raw-output tool:

Do I need the exact raw content in context right now to edit or quote it?

- yes: direct read is fine
- no: prefer `context-mode` tools first

## Maintenance

If behavior seems wrong:

- run `ctx_stats` to inspect usage and savings
- run `ctx_doctor` to diagnose install/runtime issues
- run `ctx_upgrade` to update the tool
