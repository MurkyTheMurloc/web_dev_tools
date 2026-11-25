import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countOccurrences, createLintHarness } from "./helpers.mjs";

const RULE = "hono(param-name-mismatch)";
const RULES = { "hono/param-name-mismatch": "error" };

let harness = null;

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("hono/param-name-mismatch", () => {
    test("allows matching params, basePath params, mounted subApp params, wildcard routes, and zero-arg param()", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:id/posts/:postId?", (c) => {
    const id = c.req.param("id");
    const postId = c.req.param("postId");
    const all = c.req.param();
    return c.json({ id, postId, all });
});

app.get("/files/*", (c) => c.text(c.req.param("any") ?? ""));

const api = app.basePath("/orgs/:orgId");
api.get("/teams/:teamId", (c) => {
    return c.json({
        orgId: c.req.param("orgId"),
        teamId: c.req.param("teamId")
    });
});

const sub = new Hono();
sub.get("/members/:memberId", (c) => {
    return c.json({
        tenant: c.req.param("tenantId"),
        member: c.req.param("memberId")
    });
});
app.route("/tenants/:tenantId", sub);

app.use("*", async (c, next) => {
    void c.req.param("anything");
    await next();
});
`,
            { rules: RULES }
        );

        expect(output).not.toContain(RULE);
    });

    test("reports mismatched param names and params on parameterless routes", () => {
        const { output } = harness.lint(
            `import { Hono } from "hono";

const app = new Hono();
app.get("/users/:userId", (c) => {
    return c.text(c.req.param("id") ?? "");
});

app.get("/health", (c) => {
    return c.text(c.req.param("id") ?? "");
});
`,
            { rules: RULES }
        );

        expect(countOccurrences(output, RULE)).toBe(2);
        expect(output).toContain(
            '`c.req.param("id")` does not match any parameter in route `/users/:userId` (defined: ":userId")'
        );
        expect(output).toContain(
            '`c.req.param("id")` is called in route `/health`, which defines no path parameters'
        );
    });
});
