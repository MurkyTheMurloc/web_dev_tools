---
name: simplelog
description:
    Use @murky-web/simplelog for runtime-aware logging across Node, Bun, Deno,
    web and Hono-based servers. Use when introducing or refactoring logger
    usage, child loggers, request-scoped logging, Hono middleware, or consistent
    cross-runtime logging defaults.
---

# SimpleLog

Use this skill when working with `@murky-web/simplelog` or when standardizing
logging in a codebase.

Read the references that match the task:

- [simplelog-patterns.md](references/simplelog-patterns.md) for import paths,
  runtime choices, logger options, and Hono integration patterns
- [simplelog-review-checklist.md](references/simplelog-review-checklist.md) when
  reviewing a logging refactor or deciding whether the integration is
  production-ready

## Default Approach

- Use `simplelog` as the logging surface instead of ad-hoc `console.*` calls
  once a project has standardized on it.
- Pick the runtime entry intentionally instead of always reaching for the
  default import.
- Prefer child loggers for contextual naming instead of stuffing context into
  message strings.
- Keep file logging limited to runtimes where it actually makes sense.
- Treat OpenTelemetry correlation as an opt-in layer, not as the logger's
  default responsibility.

## Context Gathering

Before changing logging, identify:

- the runtime: Node, Bun, Deno, browser, edge, or mixed
- whether the code is request-scoped server code, background work, or shared
  utility code
- whether Hono is involved
- whether the project already treats `simplelog` as the standard logging surface
- whether logs are human-oriented, machine-oriented, or both
- whether file logging is actually supported and desired

Do not assume the default package entry is correct. Choose the narrowest runtime
entry that matches the deployment target.

## Core Rules

- Use `@murky-web/simplelog` or `@murky-web/simplelog/node` for Node-first
  server code.
- Use `@murky-web/simplelog/bun` for Bun-specific code.
- Use `@murky-web/simplelog/deno` for Deno-specific code.
- Use `@murky-web/simplelog/web` for browser, edge, and fetch-style runtimes.
- Use `@murky-web/simplelog/hono` to attach a request-scoped logger to
  `c.var.logger`.
- Use `createChildLogger(...)` when code needs a narrower context, subsystem
  name, or request-local logger.
- Use `valueColorMode: "syntax"` when console readability matters and
  `valueColorMode: "off"` when plain output is more important.
- Keep `includeOpenTelemetryContext` opt-in and only enable it when the runtime
  already has an active span.
- Do not rely on file logging in runtimes where file I/O is absent or
  host-dependent.

## Migration Workflow

When replacing ad-hoc logging in an existing codebase:

1. choose the runtime entry first
2. create one intentional root logger per module, service, or server boundary
3. replace direct `console.*` calls with the nearest logger method
4. use `createChildLogger(...)` when the code naturally narrows into a
   subsystem, request, job, or adapter
5. in Hono handlers, prefer `c.var.logger` over a captured root logger
6. only add file logging where the host runtime makes it a real feature, not a
   hopeful config flag

If the project uses the local `simplelog` Oxlint preset, align the refactor with
the rules instead of working around them.

## Runtime Selection

Choose the entrypoint by deployment context:

- Node server -> `@murky-web/simplelog`
- Bun server or scripts -> `@murky-web/simplelog/bun`
- Deno runtime -> `@murky-web/simplelog/deno`
- Browser or edge runtime -> `@murky-web/simplelog/web`
- Hono middleware layer -> `@murky-web/simplelog/hono`

For Hono-based metaframeworks that may run on Node, Bun, Deno, Cloudflare, or
Netlify, prefer `@murky-web/simplelog/web` together with
`@murky-web/simplelog/hono`.

## Hono Guidance

- Create one base logger for the server runtime.
- Use `createHonoLoggerMiddleware({ logger })` to attach a request-scoped logger
  to `c.var.logger`.
- Log request work through `c.var.logger` rather than a module-global logger.
- Keep the middleware thin; framework-specific tracing or SSR handoff should
  live outside `simplelog`.

## Lint-Aware Guidance

If the local `simplelog` Oxlint plugin is active, the current rules push code
toward these conventions:

- no direct `console.*` calls
- no `console` fallback or alias patterns
- explicit runtime imports instead of the bare package root
- `logger.createChildLogger(...)` over nested `new Logger(...)`
- `c.var.logger` inside Hono handlers
- non-empty logger names

Treat those rules as codified team conventions, not as obstacles to disable.

## File Logging Guidance

- Use file logging for Node-oriented environments where persistent
  append-to-file behavior is expected.
- Do not assume file logging is portable across browser or edge runtimes.
- If a runtime is cross-platform or uncertain, prefer console output first and
  add file logging only where the host contract is explicit.

## Quality Checklist

- the chosen import matches the runtime
- direct `console.*` usage is replaced where the codebase already standardizes
  on `simplelog`
- child loggers carry context instead of bloated message prefixes
- Hono code uses request-scoped logging through `c.var.logger`
- file logging is only enabled in a runtime where it is actually supported
- OpenTelemetry context is opt-in and not treated as mandatory logger setup
