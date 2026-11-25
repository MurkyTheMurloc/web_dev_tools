import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/no-commented-out-route", () => {
    const RULE = "hono(no-commented-out-route)";
    const RULES = { "hono/no-commented-out-route": "warn" };

    test("allows prose comments, JSDoc examples, and non-Hono files", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

/**
 * @example
 * app.get("/example", (c) => c.text("ok"));
 */
const app = new Hono();
// Registers the health endpoint via app.get("/health", ...)
app.get("/health", (c) => c.text("ok"));
export { app };
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports commented-out routes in Hono files", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const server = new Hono();
// server.get("/legacy", (c) => c.text("old"));
/* app.post("/debug", (c) => c.text("dbg")); */
server.get("/ok", (c) => c.text("ok"));
export { server };
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(2);
        expect(output).toContain("Commented-out Hono route `server.get(...)`");
        expect(output).toContain("Fix: delete the commented-out route");
    });
});

describe("hono/no-process-env", () => {
    const RULE = "hono(no-process-env)";
    const RULES = { "hono/no-process-env": "error" };

    test("allows shadowed process variable and c.env", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono<{ Bindings: { API_KEY: string } }>();
app.get("/", (c) => c.text(c.env.API_KEY));

export function localShadow(process: { env: { FOO: string } }) {
    return process.env.FOO;
}
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports global process.env access", () => {
        const { output } = harness.lint(
            `export const secret = process.env.SECRET;
export const computed = process["env"].OTHER;
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(2);
        expect(output).toContain(
            "`process.env` is unavailable or empty on edge runtimes"
        );
        expect(output).toContain("env(c)");
    });
});

describe("hono/prefer-http-exception", () => {
    const RULE = "hono(prefer-http-exception)";
    const RULES = { "hono/prefer-http-exception": "warn" };

    test("allows HTTPException and throws outside Hono handlers", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

export function domainHelper() {
    throw new Error("internal invariant");
}

const app = new Hono();
app.get("/users/:id", () => {
    throw new HTTPException(404, { message: "not found" });
});
export { app };
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports throw new Error(...) directly inside Hono handlers", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:id", () => {
    throw new Error("missing user");
});
export { app };
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(1);
        expect(output).toContain("HTTPException");
        expect(output).toContain("hono/http-exception");
    });
});

describe("oxc-config integration", () => {
    test("packages/oxc-config/linting/hono.jsonc enables the core rules cleanly", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:id", (c) => {
    c.json({ id: c.req.param("wrong") });
});
app.use("*", async (_c, next) => {
    await next();
    await next();
});
export const envVal = process.env.NODE_ENV;
`,
            {
                extends: ["packages/oxc-config/linting/hono.jsonc"]
            }
        );

        expect(output).toContain("hono(no-unused-context-response)");
        expect(output).toContain("hono(param-name-mismatch)");
        expect(output).toContain("hono(global-middleware-placement)");
        expect(output).toContain("hono(no-multiple-next)");
        // Opt-in rule stays silent under default oxc-config.
        expect(output).not.toContain("hono(no-process-env)");
    });
});
