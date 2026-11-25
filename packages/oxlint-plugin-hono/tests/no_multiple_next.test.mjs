import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(no-multiple-next)";
const RULES = { "hono/no-multiple-next": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/no-multiple-next", () => {
    test("allows single next(), mutually exclusive branches, early returns, and loop exit", () => {
        const { output } = harness.lint(
            `import { Hono, type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";

const app = new Hono();

app.use("*", async (c, next) => {
    await next();
});

app.use("/branch", async (c, next) => {
    if (c.req.header("x-fast")) {
        await next();
        return;
    }
    await next();
});

app.use("/if-else", async (c, next) => {
    if (c.req.method === "GET") {
        return await next();
    } else {
        return await next();
    }
});

app.use("/loop-return", async (c, next) => {
    for (const key of ["a", "b"]) {
        if (c.req.header(key)) {
            await next();
            return;
        }
    }
    return c.text("forbidden", 403);
});

export const mw = createMiddleware(async (c, next) => {
    return c.req.header("x") ? next() : next();
});

export async function typedMw(c: Context, next: Next) {
    switch (c.req.method) {
        case "GET":
            await next();
            return;
        default:
            await next();
            return;
    }
}
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports sequential next(), fallthrough if-without-return, try+catch next(), and loop next()", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

const app = new Hono();

app.use("/seq", async (_c, next) => {
    await next();
    await next();
});

app.use("/if-fallthrough", async (c, next) => {
    if (c.req.header("x-a")) {
        await next();
    }
    await next();
});

app.use("/try-catch", async (_c, next) => {
    try {
        await next();
    } catch {
        await next();
    }
});

export const looped = createMiddleware(async (_c, next) => {
    for (let i = 0; i < 3; i += 1) {
        await next();
    }
});
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(4);
        expect(output).toContain(
            "`next()` can run more than once on the same request path"
        );
        expect(output).toContain(
            "`next()` is called inside a loop without exiting on the same iteration"
        );
        expect(output).toContain("Do not:");
    });
});
