---
"@murky-web/simplelog": patch
---

The oxlint rules' messages quote the reported code (`console.warn("oops")`,
`logger ?? console`, `new Logger("")`), say what the line loses at runtime and
give a copyable `Fix:` built from that code, such as `logger.warn("oops")`,
`c.var.logger.info("bad")` or `new Logger("server")` (named after the file).
`prefer-runtime-entry` no longer offers `@murky-web/simplelog/hono` as a place
to import `Logger` from. What the rules report is unchanged.
