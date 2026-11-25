import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(no-unused-context-response)";
const RULES = { "hono/no-unused-context-response": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/no-unused-context-response", () => {
    test("allows returned, assigned, concise arrow, and side-effecting context calls", () => {
        const { output } = harness.lint(
            `import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";

const app = new Hono();

app.get("/concise", (c) => c.json({ ok: true }));
app.get("/returned", (c) => {
    c.header("x-test", "1");
    c.status(201);
    return c.text("created");
});
app.get("/stored", (c) => {
    const res = c.html("<p>hi</p>");
    return res;
});
app.use("*", async (c, next) => {
    await next();
    c.res = c.newResponse("wrapped", 200);
});
app.onError((err, c) => {
    return c.json({ error: err.message }, 500);
});

export const mw = createMiddleware(async (c, next) => {
    await next();
    c.res = c.body("ok");
});

export function helper(c: Context) {
    const items = [{ text: () => "ignored" }];
    items.forEach((c) => {
        c.text();
    });
    return c.redirect("/home");
}
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("ignores non-Hono code with similar method names", () => {
        const { output } = harness.lint(
            `const client = { json: () => ({}), text: () => "" };
function run(c: typeof client) {
    c.json();
    c.text();
}
export { run };
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports discarded context responses across route handlers, onError, createMiddleware, and typed Context handlers", () => {
        const { output } = harness.lint(
            `import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";

const app = new Hono();

app.get("/users", (c) => {
    c.json({ ok: true });
});

app.post("/items", async (c) => {
    await c.html("<p>discarded</p>");
    void c.redirect("/login");
    return c.text("fallback");
});

app.onError((_err, ctx) => {
    ctx.text("failed", 500);
});

export const auth = createMiddleware(async (c, next) => {
    if (!c.req.header("authorization")) {
        c.json({ error: "unauthorized" }, 401);
        return;
    }
    await next();
});

export function standalone(c: Context) {
    c.notFound();
}
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(6);
        expect(output).toContain(
            "`c.json(...)` only constructs a `Response` and does not send it"
        );
        expect(output).toContain(
            "Fix: return the response (`return c.json(...)`)"
        );
        expect(output).toContain(
            "`ctx.text(...)` only constructs a `Response`"
        );
        expect(output).toContain(
            "Do not: wrap the call in `void` or disable the rule."
        );
    });
});
