---
"@murky-web/simplelog": minor
---

Smaller browser bundles. In the browser, `@murky-web/simplelog/web` now resolves through its `browser` export condition to a logger with the same API that passes arguments to the console as they are (objects stay expandable in DevTools) and colors only the header, with `%c`. Without the JSON serializer, the ANSI formatting and the log file code, one logger call costs about 4.6 kB minified instead of 9.2 kB (2.0 kB instead of 3.4 kB gzip, Vite 8). Server runtimes (`workerd`, `worker`, `edge-light`, `deno`, `bun`, `node`) keep the text logger. The browser logger applies the same allow-list to `Error` arguments (`name`, `message`, `stack`, `cause`, `code`, `errors`), so a server bundle that resolves it by mistake does not print request headers either.

The log file line is now built only when a file is written; before, it was built for every call.
