---
name: context7-defaults
description:
    Repository-local Context7 defaults with pinned approved libraries and direct
    sources for this project.
---

# Context7 Defaults

Use Context7 as the default source of truth for third-party library and API
behavior before relying on memory.

Prefer this skill whenever the task depends on external documentation being
current, precise, or version-aware.

## Workflow

1. Identify the external library, framework, SDK, or API involved.
2. Check the local approved source lists before resolving anything new.
3. If the target library is pinned in
   [`approved-libraries.md`](./references/approved-libraries.md), use that
   Context7 ID directly.
4. If the task uses an official source outside Context7, only use it when it
   appears in
   [`approved-direct-sources.md`](./references/approved-direct-sources.md).
5. Base setup steps, configuration guidance, and generated code on those
   approved sources.
6. Mark any conclusion that is not directly sourced as an inference.

## Local References

- [`approved-libraries.md`](./references/approved-libraries.md)
- [`approved-direct-sources.md`](./references/approved-direct-sources.md)
