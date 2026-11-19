---
"@murky-web/simplelog": minor
---

Audit fixes. This is a minor release because it adds an option and changes
output formats; read the behaviour changes below if you parse the logs.

Behaviour changes:

- The Hono middleware no longer logs the `url` field (it carried the query
  string, which often holds tokens and OAuth codes). It logs `path` only.
- New option `includeQuery: true` on `createHonoLoggerMiddleware` adds a
  separate `query` field (`"?a=1"`). `RequestLoggerContext`, which is passed to
  a custom `requestLoggerName`, has a new `query` string next to the existing
  `url`.
- The file line format changed. It now contains the log arguments (before, only
  the message was written): the console line without colors, objects as compact
  single-line JSON. Stack traces follow their entry as tab-prefixed continuation
  lines. Control characters, line and paragraph separators, bidi controls and
  the byte order mark are escaped in the message, the logger name and the
  arguments, so user text cannot forge or disguise a log line.
- `Error` arguments print `name`, `message`, `stack`, `cause`, a string or
  number `code` and the `errors` of an `AggregateError` instead of `{}`. Other
  own properties are left out because HTTP client errors carry request headers
  and bodies there. Inside an Error, a `cause` or `errors` element that is not
  an Error prints as `"[Object]"`.
- Cyclic objects (`"[Circular]"`), BigInt (`"123n"`), `Map`, `Set`, boxed
  primitives and typed arrays (a label with the byte length) no longer collapse
  to `[Object]` or `{}`. Output is bounded: 8 levels, 1000 values, 50 keys or
  items per object or array, with `"[Truncated]"` markers.

Fixes:

- The middleware no longer reads `c.res` before `next()`, so Hono returns the
  handler's own `Response` instead of a copy (this broke response identity and
  could break WebSocket upgrades).
- `hono` is now an optional peer dependency, because only
  `@murky-web/simplelog/hono` imports it.
- The README no longer points to the removed `@murky-web/config`, shows the
  Oxlint setup directly and documents the output format.
