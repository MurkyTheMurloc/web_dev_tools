import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(global-middleware-placement)";
const RULES = { "hono/global-middleware-placement": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/global-middleware-placement", () => {
    test("allows global middleware before routes, scoped middleware after routes, and onError/notFound anywhere", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
const logger = () => async (_c: unknown, next: () => Promise<void>) => { await next(); };

app.use(logger());
app.use("*", async (_c, next) => { await next(); });
app.get("/health", (c) => c.text("ok"));
app.use("/admin/*", async (_c, next) => { await next(); });
app.get("/admin/dashboard", (c) => c.text("admin"));
app.onError((_err, c) => c.text("err", 500));
app.notFound((c) => c.text("404", 404));

const api = app.basePath("/api");
api.use("*", async (_c, next) => { await next(); });
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports global app.use(mw) and app.use('*', mw) registered after routes or app.route()", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
const sub = new Hono();
const cors = () => async (_c: unknown, next: () => Promise<void>) => { await next(); };

app.get("/health", (c) => c.text("ok"));
app.use("*", cors());

const app2 = new Hono();
app2.route("/api", sub);
app2.use(cors());

const chained = new Hono()
    .get("/a", (c) => c.text("a"))
    .use("*", cors());

export { app, app2, chained };
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(3);
        expect(output).toContain(
            'Global middleware `app.use("*", ...)` is registered after route `app.get("/health", ...)`'
        );
        expect(output).toContain(
            "Fix: move this `use(...)` call above the first route registration"
        );
    });
});
