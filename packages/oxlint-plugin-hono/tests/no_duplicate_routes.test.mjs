import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(no-duplicate-routes)";
const RULES = { "hono/no-duplicate-routes": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/no-duplicate-routes", () => {
    test("allows distinct methods, multiple app.use middlewares, separate apps, and mutually exclusive if/else", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.use("/api/*", async (_c, next) => { await next(); });
app.use("/api/*", async (_c, next) => { await next(); });
app.get("/users", (c) => c.text("list"));
app.post("/users", (c) => c.text("create"));

if (process.env.NODE_ENV === "development") {
    app.get("/debug", (c) => c.text("dev"));
} else {
    app.get("/debug", (c) => c.text("prod"));
}

const other = new Hono();
other.get("/users", (c) => c.text("other app"));
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports duplicate routes across direct calls, chains, trailing slashes, basePath, and app.route", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users", (c) => c.text("first"));
app.get("/users/", (c) => c.text("second"));

const chained = new Hono()
    .post("/items", (c) => c.text("one"))
    .post("/items", (c) => c.text("two"));

const v1 = app.basePath("/v1");
v1.get("/health", (c) => c.text("v1"));
app.get("/v1/health", (c) => c.text("root collision"));

const sub = new Hono();
sub.get("/ping", (c) => c.text("sub ping"));
app.get("/api/ping", (c) => c.text("direct ping"));
app.route("/api", sub);

export { app, chained };
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(4);
        expect(output).toContain(
            "`GET /users` is already registered on this Hono app"
        );
        expect(output).toContain(
            "`POST /items` is already registered on this Hono app"
        );
        expect(output).toContain(
            "`GET /v1/health` is already registered on this Hono app"
        );
        expect(output).toContain(
            "`GET /api/ping` is already registered on this Hono app"
        );
        expect(output).toContain(
            "Do not: keep both registrations or disable the rule."
        );
    });
});
