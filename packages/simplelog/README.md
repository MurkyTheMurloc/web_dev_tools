# SimpleLog

`SimpleLog` is a lightweight and flexible logging utility for Node.js, Bun, Deno, and fetch-style edge runtimes. It provides various log levels, performance benchmarking, and the ability to log messages to both the console and a file.

## Features

-   Multiple log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`
-   Performance benchmarking
-   Log messages to console and/or file
-   Colorized console output
-   Nested loggers for hierarchical logging
-   Request-scoped logging for Hono servers
-   Optional OpenTelemetry trace correlation

## Installation

SimpleLog is currently used as an internal workspace package in `web_kit`.
External publish and install instructions will be added again later.

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

Deno:

```typescript
import { Logger } from "@murky-web/simplelog/deno";
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

-   `writeToFile`: Boolean indicating whether to write logs to a file.
-   `logFilePath`: Path to the log file.
-   `logLevelThreshold`: Minimum log level for logging.
-   `valueColorMode`: `"level" | "syntax" | "off"` for console value coloring.
-   `includeOpenTelemetryContext`: Adds active `trace_id` and `span_id` to each log line when an OpenTelemetry span is active.

`valueColorMode` modes:

- `level`: current default, all console pieces use the log-level color
- `syntax`: extra values use type-based colors like strings, numbers, booleans, nullish values, symbols, and objects
- `off`: console output stays plain

`includeOpenTelemetryContext` is intentionally opt-in. When enabled, `simplelog` reads the current active span from `@opentelemetry/api` and appends `trace_id` and `span_id` to console and file output. It does not install an OpenTelemetry SDK or exporter for you.

## Log Levels

-   `DEBUG`: Detailed information, typically of interest only when diagnosing problems.
-   `INFO`: Confirmation that things are working as expected.
-   `WARN`: An indication that something unexpected happened, or indicative of some problem in the near future.
-   `ERROR`: Error events of considerable importance that will prevent normal program execution.

## Runtime Variants

- `@murky-web/simplelog`: Node-first default entry
- `@murky-web/simplelog/node`: explicit Node entry
- `@murky-web/simplelog/bun`: Bun entry
- `@murky-web/simplelog/deno`: Deno entry
- `@murky-web/simplelog/web`: runtime-neutral console logger for fetch-style runtimes
- `@murky-web/simplelog/hono`: Hono middleware for request-scoped logging

For Bun, file appends intentionally use Bun's `node:fs` compatibility layer because the native `Bun.file(...).writer()` flow overwrites existing file contents instead of appending in our local runtime check.

## Hono Middleware

For Hono-based servers and metaframeworks, prefer the runtime-neutral `web` logger together with the Hono middleware entry:

```typescript
import { Hono } from "hono";

import { createHonoLoggerMiddleware } from "@murky-web/simplelog/hono";
import { Logger } from "@murky-web/simplelog/web";

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

The middleware exposes `c.var.logger`, and it logs request completion with method, path, status, duration, request ID, and Hono's runtime key.

This adapter is intentionally thin:

- it uses Hono's middleware and request context model
- it creates a request-scoped child logger
- it works across Node, Bun, Deno, Cloudflare, and Netlify style runtimes
- it does not own your tracing SDK or framework-specific SSR handoff

If you want a custom request logger name, you can provide one directly or resolve it per request:

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

## OpenTelemetry Integration

`simplelog` is OpenTelemetry-aware, but not OpenTelemetry-owning.

That means:

- `simplelog` reads the active span from `@opentelemetry/api`
- `simplelog` appends `trace_id` and `span_id` when `includeOpenTelemetryContext` is enabled
- your application or metaframework is still responsible for installing the OpenTelemetry SDK, context manager, instrumentations, and exporters

Minimal logger setup:

```typescript
import { Logger } from "@murky-web/simplelog/web";

const logger = new Logger("server", undefined, {
    includeOpenTelemetryContext: true,
    valueColorMode: "off",
});
```

Once your runtime has an active span, log lines automatically include the current trace correlation data:

```text
2026-03-18T22:00:00.000Z [INFO] [server -> request] [trace_id=... span_id=...] - Request completed
```

`simplelog` deliberately does not bootstrap tracing for you. In production, that usually belongs in the metaframework or host integration layer, because the exact setup depends on your runtime, deployment target, and exporter infrastructure.

## Hono + OpenTelemetry Together

For a Hono-based metaframework, the usual shape is:

1. Your framework boots OpenTelemetry for the current runtime.
2. Hono request handling creates or activates a request span.
3. `createHonoLoggerMiddleware()` attaches a request-scoped logger to `c.var.logger`.
4. `simplelog` reads the active span and appends `trace_id` and `span_id`.

That gives you:

- one consistent logger API on server and client
- request-scoped child loggers during SSR and server work
- trace-correlated logs that continue to work with real OpenTelemetry infrastructure later

For Node-only servers where file logging matters, you can still use the default `@murky-web/simplelog` entry. For truly cross-runtime Hono usage, `@murky-web/simplelog/web` is the safer default.

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
    "This debug message will not be logged because the threshold is INFO"
);
logger.warn("This is a warning");
logger.error("This is an error");
```

## License

This project is licensed under the MIT License.
