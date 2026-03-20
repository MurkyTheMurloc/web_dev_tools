# SimpleLog Review Checklist

Use this checklist when reviewing a `simplelog` migration or integration.

## Runtime Choice

- Does the import match the actual runtime?
- Is `@murky-web/simplelog/web` used for cross-runtime Hono or edge-style code?
- Is the bare package root avoided unless the code is genuinely Node-first?

## Logger Topology

- Is there one intentional root logger instead of repeated ad-hoc
  `new Logger(...)` calls?
- Are child loggers used for subsystems, requests, jobs, or adapters?
- Are logger names non-empty and descriptive?

## Hono Usage

- Is request-scoped logging attached through `createHonoLoggerMiddleware(...)`?
- Do handlers use `c.var.logger` instead of closing over a root logger?
- Is the middleware kept thin rather than overloaded with framework-specific
  state transfer?

## Console Migration

- Are direct `console.*` calls removed where the project standardizes on
  `simplelog`?
- Are `console` aliases and fallbacks removed too, not just the obvious direct
  calls?
- Are message prefixes being replaced with child logger context where that reads
  better?

## File Logging

- Is file logging only enabled where the runtime actually supports it?
- Is the chosen entrypoint compatible with the file-logging expectation?
- Is file output being treated as a host-specific concern instead of a universal
  default?

## OpenTelemetry

- Is `includeOpenTelemetryContext` only enabled where an active span is
  expected?
- Does the app or framework own tracing setup, rather than the logger package?
- Is the logger integration still useful when tracing is disabled?
