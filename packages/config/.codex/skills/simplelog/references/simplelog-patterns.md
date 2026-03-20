# SimpleLog Patterns

## Runtime Entrypoints

Use the narrowest entry that matches the runtime:

```ts
import { Logger } from "@murky-web/simplelog";
import { Logger as BunLogger } from "@murky-web/simplelog/bun";
import { Logger as DenoLogger } from "@murky-web/simplelog/deno";
import { Logger as WebLogger } from "@murky-web/simplelog/web";
```

The default package is Node-first. For cross-runtime server work, especially
with Hono, prefer `@murky-web/simplelog/web`.

## Base Logger Setup

```ts
import { Logger } from "@murky-web/simplelog/web";

const logger = new Logger("server", undefined, {
    logLevelThreshold: "INFO",
    valueColorMode: "off",
});
```

Useful options:

- `writeToFile`
- `logFilePath`
- `logLevelThreshold`
- `valueColorMode: "level" | "syntax" | "off"`
- `includeOpenTelemetryContext`

## Child Loggers

Prefer child loggers for subsystem context:

```ts
const appLogger = new Logger("app");
const dbLogger = appLogger.createChildLogger("db");

dbLogger.info("Connected");
```

This is better than repeating `[db]` in message strings.

## Hono Middleware

```ts
import { Hono } from "hono";

import { createHonoLoggerMiddleware } from "@murky-web/simplelog/hono";
import { Logger } from "@murky-web/simplelog/web";

type AppVariables = {
    logger: Logger;
};

const app = new Hono<{ Variables: AppVariables }>();
const logger = new Logger("server", undefined, {
    valueColorMode: "off",
});

app.use(createHonoLoggerMiddleware({ logger }));

app.get("/", (c) => {
    c.var.logger.info("Handling request");
    return c.text("ok");
});
```

For Hono, use `c.var.logger` inside handlers instead of a global logger.

## OpenTelemetry Is Optional

If the host app already provides an active span, `simplelog` can append
`trace_id` and `span_id`:

```ts
const logger = new Logger("server", undefined, {
    includeOpenTelemetryContext: true,
    valueColorMode: "off",
});
```

Do not treat this as required logger setup. It should stay an opt-in layer.

## Runtime Recommendations

- Node services that want file logging: use the default Node entry.
- Bun-only code: use the Bun entry.
- Deno-only code: use the Deno entry.
- Browser, edge, SSR adapters, or Hono across runtimes: use the web entry.

## What To Avoid

- sprinkling `console.log` and `console.error` through app code once `simplelog`
  is the standard logger
- choosing the Node entry by habit inside code that is meant to run
  cross-runtime
- pushing request context into message strings instead of child loggers
- assuming OpenTelemetry setup belongs inside the logger package itself
