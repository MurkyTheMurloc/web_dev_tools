# @murky-web/oxlint-plugin-hono

Oxlint JS-Plugin (Praefix `hono`) mit Regeln fuer Hono-Apps (Hono 4/5,
`createMiddleware`, `createFactory`) und agent-ready Fehlermeldungen.

## Einbinden

```jsonc
{
    "jsPlugins": ["@murky-web/oxlint-plugin-hono"],
    "rules": {
        "hono/no-unused-context-response": "error",
        "hono/no-multiple-next": "error",
        "hono/no-duplicate-path-params": "error",
        "hono/no-duplicate-routes": "error",
        "hono/param-name-mismatch": "error",
        "hono/global-middleware-placement": "error",
        "hono/no-commented-out-route": "warn",
        "hono/no-process-env": "off",
        "hono/prefer-http-exception": "off"
    }
}
```

`@murky-web/oxc-config` bindet das Plugin und die Standardkonfiguration ueber
`linting/hono.jsonc` automatisch ein.

## Regeln

| Regel                              | Default in `oxc-config` | Zweck                                                                                                                             |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `hono/no-unused-context-response`  | `error`                 | Meldet verworfene `c.json(...)` / `c.text(...)` / `c.html(...)` / `c.redirect(...)`-Aufrufe ohne `return` oder `c.res = ...`.     |
| `hono/no-multiple-next`            | `error`                 | Meldet mehrfaches `next()` auf demselben Ausfuehrungspfad in Hono-Middleware (inkl. `createMiddleware` und Schleifen).            |
| `hono/no-duplicate-path-params`    | `error`                 | Meldet doppelte `:param`-Namen in einer Route (inkl. `basePath()`-Praefix und Regex-/Optional-Parameter).                         |
| `hono/no-duplicate-routes`         | `error`                 | Meldet doppelt registrierte `(Method, Path)`-Kombinationen auf derselben Hono-Instanz (inkl. `basePath()` und `app.route()`).     |
| `hono/param-name-mismatch`         | `error`                 | Meldet `c.req.param("foo")`, wenn `:foo` in der umschliessenden Route (inkl. `basePath()` / `app.route()`) nicht definiert ist.   |
| `hono/global-middleware-placement` | `error`                 | Meldet globale Middleware (`app.use(mw)` / `app.use("*", mw)`), die erst nach Routen auf derselben Hono-Instanz registriert wird. |
| `hono/no-commented-out-route`      | `warn`                  | Meldet auskommentierte Hono-Routen (`// app.get(...)`).                                                                           |
| `hono/no-process-env`              | `off`                   | Verbietet `process.env` zugunsten von `c.env` / `env(c)` fuer Edge-Runtimes (Cloudflare Workers etc.).                            |
| `hono/prefer-http-exception`       | `off`                   | Schlaegt `HTTPException` aus `hono/http-exception` statt `new Error(...)` in Hono-Handlern vor.                                   |
