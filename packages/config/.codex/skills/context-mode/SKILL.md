---
name: context-mode
description:
    Use context-mode MCP tools and routing instructions to reduce context bloat
    in Codex sessions. Use when large command output, logs, web content, or
    broad exploration would otherwise flood the context window.
---

# Context Mode

Use this skill when working in Codex with the `context-mode` MCP server.

Prefer it whenever the task is likely to generate large raw output:

- shell commands with long output
- repeated grep or search passes
- log inspection
- large docs or markdown files
- fetched web pages
- broad file analysis across a repo

## Codex Constraint

Codex does not support hooks for `context-mode`. The main enforcement layer is
`AGENTS.md` routing instructions in the project root or `~/.codex/AGENTS.md`.

That means compliance is not automatic. Use the tools deliberately.

## Best Practices

1. Prefer `ctx_batch_execute` over many small commands when a task is naturally
   batchable.
2. Prefer `ctx_execute_file` for file analysis when you do not need raw file
   contents in context.
3. Prefer `ctx_fetch_and_index` or `ctx_index` plus `ctx_search` for docs,
   logs, markdown, and fetched pages.
4. Use direct file reads only when you truly need exact file contents in
   context to edit or quote them.
5. For repeated investigation, index once and search many times.
6. For editing, direct reads are fine. For exploration, prefer
   sandbox/index/search flows first.

## Tool Order

- multi-command exploration: `ctx_batch_execute`
- one noisy command: `ctx_execute`
- file analysis without dumping raw content: `ctx_execute_file`
- large text or docs: `ctx_index` then `ctx_search`
- external pages or APIs: `ctx_fetch_and_index` then `ctx_search`

## Maintenance Commands

Use these when behavior seems off:

- `ctx_stats`
- `ctx_doctor`
- `ctx_upgrade`

Read [codex-best-practices.md](references/codex-best-practices.md) when you
need the Codex-specific rationale or decision rules.
