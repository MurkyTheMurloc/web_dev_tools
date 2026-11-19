# SimpleLog

`SimpleLog` is a lightweight and flexible logging utility for Node.js, Bun and
fetch-style edge runtimes. It provides various log levels, performance
benchmarking, and the ability to log messages to both the console and a file.

## Features

- Multiple log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`
- Performance benchmarking
- Log messages to console and/or file
- Colorized console output
- Nested loggers for hierarchical logging
- Request-scoped logging for Hono servers
- Optional OpenTelemetry trace correlation

## Installation

```bash
bun add @murky-web/simplelog
```

## Usage

### Importing and Creating a Logger

Node:

```typescript
import { Logger } from "@murky-web/simplelog";

const logger = new Logger("MyLogger", undefined, {
    writeToFile: true,
    logFilePath: "logs/mylogger.log",
    logLevelThreshold: "DEBUG",
    valueColorMode: "syntax",
});
```

Bun:

```typescript
import { Logger } from "@murky-web/simplelog/bun";
```

Web and edge runtimes:

```typescript
import { Logger } from "@murky-web/simplelog/web";
```

### Logging Messages

```typescript
logger.debug("This is a debug message");
logger.info("This is an info message");
logger.warn("This is a warning message");
logger.error("This is an error message");
```

### Performance Benchmarking

```typescript
logger.startPerformanceBenchmark("test");
// ... some code to benchmark ...
logger.endPerformanceBenchmark("test", "Benchmark completed");
```

### Assertions

```typescript
logger.assert(1 + 1 === 2, "Math is broken!");
```

### Creating Child Loggers

```typescript
const childLogger = logger.createChildLogger("ChildLogger");
childLogger.info("This is a message from the child logger");
```

## Logger Options

- `writeToFile`: Boolean indicating whether to write logs to a file.
- `logFilePath`: Path to the log file.
- `logLevelThreshold`: Minimum log level for logging.
- `valueColorMode`: `"level" | "syntax" | "off"` for console value coloring.
- `timestampFormat`: `"iso" | "time"` for the console timestamp.
- `includeOpenTelemetryContext`: Adds active `trace_id` and `span_id` to each
  log line when an OpenTelemetry span is active.

`valueColorMode` modes:

- `level`: all console pieces use the log-level color
- `syntax`: extra values use type-based colors like strings, numbers, booleans,
  nullish values, symbols, and objects
- `off`: console output stays plain

`timestampFormat` modes:

- `iso`: the full UTC timestamp, `2026-11-19T16:59:23.745Z`
- `time`: the local time of day, `16:59:23.745`

### Defaults for colors and timestamps

Without the option, the Node and Bun entries pick both from the environment when
a logger is created. Child loggers inherit the parent's values.

Colors (`valueColorMode`), `NO_COLOR` as https://no-color.org defines it plus
Node's `FORCE_COLOR` values:

1. `NO_COLOR` set and not empty: `"off"`.
2. `FORCE_COLOR` set: `"level"`, even when empty, except `FORCE_COLOR=0` or
   `false`, which means `"off"`.
3. Otherwise `"level"` when stdout is a terminal, `"off"` when it is a pipe or a
   file (CI, systemd, Docker, a process manager).

The check looks at stdout only. Stack traces of `error()` and `assert()` go to
stderr with the same colors, so `app 2>errors.log` in a terminal writes ANSI
codes into `errors.log`; set `NO_COLOR=1` there.

Timestamp (`timestampFormat`):

1. `SIMPLELOG_TIMESTAMP=time` or `SIMPLELOG_TIMESTAMP=iso`.
2. Otherwise `"time"` when stdout is a terminal, `"iso"` when it is not.

Set `SIMPLELOG_TIMESTAMP=time` for output that goes through a pipe but is read
by people, for example a process manager's terminal UI.

An explicit option always wins over the environment. Log files always get the
ISO timestamp and never colors, whatever the console shows. The `web` entry has
no terminal to ask: it keeps `"level"` and `"iso"`.

`includeOpenTelemetryContext` is intentionally opt-in. When enabled, `simplelog`
reads the current active span from `@opentelemetry/api` and appends `trace_id`
and `span_id` to console and file output. It does not install an OpenTelemetry
SDK or exporter for you.

## Output Format

### File lines

A log file entry is the console line without colors: ISO timestamp, level,
logger name, message, then every additional argument separated by a space.
Objects are written as compact, single-line JSON (the console keeps the indented
form), so one entry is one line.

Control characters, the Unicode line and paragraph separators (U+2028, U+2029),
the bidirectional controls (U+200E, U+200F, U+061C, U+202A to U+202E, U+2066 to
U+2069) and the byte order mark (U+FEFF) in the message, the logger name and the
arguments are written as `\n`, `\r` or `\uXXXX`. A value cannot start a line of
its own or disguise one. Tab and backslash are left alone (escaping backslashes
would mangle Windows paths), so the file is readable text, not an encoding you
can reverse unambiguously.

A stack trace is written after its entry as continuation lines, each starting
with a tab. Every entry starts with a timestamp, never with a tab.

### How arguments are printed

- An `Error` prints only `name`, `message`, `stack`, `cause`, `code` when it is
  a string or a number, and, for an `AggregateError`, `errors`. All other
  properties are left out on purpose: HTTP client errors (axios, got) carry the
  request, its headers and its body there.
- Inside an Error, `cause` and the elements of `errors` print in full only when
  they are Errors themselves (same rules, recursively). Primitives print as they
  are. Any other object prints as `"[Object]"`, because a `cause` is often an
  HTTP response or request with credentials in it.
- `Map` prints as `{ "Map": [[key, value]] }`, `Set` as `{ "Set": [value] }`,
  `BigInt` as `"123n"`, a function as `"[Function name]"`, `String`, `Number`
  and `Boolean` objects as their primitive value.
- Typed arrays, `DataView` and `ArrayBuffer` print as a label with their byte
  length, for example `"[Uint8Array 5000000 bytes]"`. Their contents are not
  printed.
- Cycles print as `"[Circular]"`, nesting deeper than 8 levels as
  `"[MaxDepth]"`.
- A call prints at most 1000 values per argument, and 50 keys per object and 50
  items per array, `Map` or `Set`. What is left out is shown as `"[Truncated]"`
  (an object gets a `"[Truncated]": <omitted keys>` entry).
- Arrays, `Map` and `Set` are not walked past the 50th item: the omitted count
  comes from `length` or `size`, so even a sparse array of length 2^32 - 1 is
  cheap. An object's key list is built in full before the first 50 are kept
  (JavaScript has no way to stop that early), so an object with millions of keys
  costs one pass over its keys, but none of its values are serialized.

simplelog does not look for secrets. Tokens, passwords or personal data you put
in a message or in an argument are written as they are; redacting them is up to
the caller.

## Log Levels

- `DEBUG`: Detailed information, typically of interest only when diagnosing
  problems.
- `INFO`: Confirmation that things are working as expected.
- `WARN`: An indication that something unexpected happened, or indicative of
  some problem in the near future.
- `ERROR`: Error events of considerable importance that will prevent normal
  program execution.

## Runtime Variants

- `@murky-web/simplelog`: Node-first default entry
- `@murky-web/simplelog/node`: explicit Node entry
- `@murky-web/simplelog/bun`: Bun entry
- `@murky-web/simplelog/web`: runtime-neutral console logger for fetch-style
  runtimes
- `@murky-web/simplelog/hono`: Hono middleware for request-scoped logging

For Bun, file appends intentionally use Bun's `node:fs` compatibility layer
because the native `Bun.file(...).writer()` flow overwrites existing file
contents instead of appending in our local runtime check.

## Hono Middleware

For Hono-based servers and metaframeworks, prefer the runtime-neutral `web`
logger together with the Hono middleware entry:

```typescript
import { createHonoLoggerMiddleware } from "@murky-web/simplelog/hono";
import { Logger } from "@murky-web/simplelog/web";
import { Hono } from "hono";

type AppVariables = {
    logger: Logger;
};

const app = new Hono<{ Variables: AppVariables }>();
const logger = new Logger("server", undefined, {
    includeOpenTelemetryContext: true,
    valueColorMode: "off",
});

app.use(createHonoLoggerMiddleware({ logger }));

app.get("/", (c) => {
    c.var.logger.info("Handling request");
    return c.text("ok");
});
```

The middleware exposes `c.var.logger`, and it logs request completion with
method, path, status, duration, request ID, and Hono's runtime key.

The query string is not logged: query strings often carry tokens, OAuth codes
and e-mail addresses. If you need it, opt in with `includeQuery: true`; it then
appears as a separate `query` field (`"?q=cats&page=2"`) next to `path`:

```typescript
app.use(createHonoLoggerMiddleware({ logger, includeQuery: true }));
```

`hono` is an optional peer dependency. Only the `@murky-web/simplelog/hono`
entry imports it, so you need it installed only when you use the middleware.

This adapter is intentionally thin:

- it uses Hono's middleware and request context model
- it creates a request-scoped child logger
- it works across Node, Bun, Cloudflare, and Netlify style runtimes
- it does not own your tracing SDK or framework-specific SSR handoff

If you want a custom request logger name, you can provide one directly or
resolve it per request:

```typescript
app.use(
    createHonoLoggerMiddleware({
        logger,
        requestLoggerName(context) {
            return `${context.runtime}:${context.path}`;
        },
    }),
);
```

The `context` has `method`, `path`, `query` (the query string with its leading
`?`, or `""`), `requestId`, `runtime` and `url`. The middleware itself logs
`query` only with `includeQuery: true`; a name you build from `context.query` or
`context.url` puts the query string into the log, so leave it out unless you
want that.

## Oxlint Integration

`@murky-web/simplelog/oxlint` exports the SimpleLog-specific Oxlint JS plugin.

Current rules:

- `simplelog/prefer-simplelog`
- `simplelog/prefer-child-logger`
- `simplelog/no-ad-hoc-console-fallback`
- `simplelog/no-console-alias`
- `simplelog/prefer-hono-context-logger`
- `simplelog/prefer-runtime-entry`
- `simplelog/require-logger-name`

Enable the plugin and the rules in your `.oxlintrc.jsonc`:

```jsonc
{
    "jsPlugins": ["@murky-web/simplelog/oxlint"],
    "rules": {
        "simplelog/prefer-simplelog": "error",
        "simplelog/prefer-child-logger": "error",
        "simplelog/no-ad-hoc-console-fallback": "error",
        "simplelog/no-console-alias": "error",
        "simplelog/prefer-hono-context-logger": "error",
        "simplelog/prefer-runtime-entry": "error",
        "simplelog/require-logger-name": "error",
    },
}
```

## OpenTelemetry Integration

`simplelog` is OpenTelemetry-aware, but not OpenTelemetry-owning.

That means:

- `simplelog` reads the active span from `@opentelemetry/api`
- `simplelog` appends `trace_id` and `span_id` when
  `includeOpenTelemetryContext` is enabled
- your application or metaframework is still responsible for installing the
  OpenTelemetry SDK, context manager, instrumentations, and exporters

Minimal logger setup:

```typescript
import { Logger } from "@murky-web/simplelog/web";

const logger = new Logger("server", undefined, {
    includeOpenTelemetryContext: true,
    valueColorMode: "off",
});
```

Once your runtime has an active span, log lines automatically include the
current trace correlation data:

```text
2026-03-18T22:00:00.000Z [INFO] [server -> request] [trace_id=... span_id=...] - Request completed
```

`simplelog` deliberately does not bootstrap tracing for you. In production, that
usually belongs in the metaframework or host integration layer, because the
exact setup depends on your runtime, deployment target, and exporter
infrastructure.

## Hono + OpenTelemetry Together

For a Hono-based metaframework, the usual shape is:

1. Your framework boots OpenTelemetry for the current runtime.
2. Hono request handling creates or activates a request span.
3. `createHonoLoggerMiddleware()` attaches a request-scoped logger to
   `c.var.logger`.
4. `simplelog` reads the active span and appends `trace_id` and `span_id`.

That gives you:

- one consistent logger API on server and client
- request-scoped child loggers during SSR and server work
- trace-correlated logs that continue to work with real OpenTelemetry
  infrastructure later

For Node-only servers where file logging matters, you can still use the default
`@murky-web/simplelog` entry. For truly cross-runtime Hono usage,
`@murky-web/simplelog/web` is the safer default.

## Example

```typescript
import { Logger } from "@murky-web/simplelog";

const logger = new Logger("AppLogger", undefined, {
    writeToFile: true,
    logFilePath: "logs/app.log",
    logLevelThreshold: "INFO",
});

logger.info("Application started");
logger.debug(
    "This debug message will not be logged because the threshold is INFO",
);
logger.warn("This is a warning");
logger.error("This is an error");
```

## License

This project is licensed under the MIT License.
