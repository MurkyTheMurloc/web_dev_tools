import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(no-duplicate-path-params)";
const RULES = { "hono/no-duplicate-path-params": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/no-duplicate-path-params", () => {
    test("allows distinct params and regex constraints containing colons", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:userId/posts/:postId", (c) => c.text("ok"));
app.get("/items/:id{(?:foo|bar)}/sub/:subId{[0-9]{1,3}}?", (c) => c.text("ok"));

const api = app.basePath("/orgs/:orgId");
api.get("/members/:memberId", (c) => c.text("ok"));
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports duplicate params in direct routes, regex/optional variants, and basePath combinations", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:id/posts/:id", (c) => c.text("ok"));
app.get("/items/:id{[0-9]+}/child/:id?", (c) => c.text("ok"));

const orgs = app.basePath("/orgs/:id");
orgs.get("/projects/:id", (c) => c.text("ok"));
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(3);
        expect(output).toContain(
            "defines parameter `:id` more than once, so the later segment silently overwrites"
        );
        expect(output).toContain(
            "Fix: give each path parameter a distinct name"
        );
    });
});
