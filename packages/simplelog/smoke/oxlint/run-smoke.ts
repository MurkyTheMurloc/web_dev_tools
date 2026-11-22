const smokeDir = new URL("./", import.meta.url);
const configPath = new URL("./.oxlintrc.jsonc", smokeDir);
const badPath = new URL("./bad.ts", smokeDir);
const goodPath = new URL("./good.ts", smokeDir);

const expectedRuleIds = [
    "simplelog(prefer-runtime-entry)",
    "simplelog(require-logger-name)",
    "simplelog(no-console-alias)",
    "simplelog(no-ad-hoc-console-fallback)",
    "simplelog(prefer-child-logger)",
    "simplelog(prefer-hono-context-logger)",
    "simplelog(prefer-simplelog)"
] as const;

const badResult =
    await Bun.$`oxlint -f json -c ${configPath.pathname} ${badPath.pathname}`
        .nothrow()
        .quiet();
const badOutput = `${badResult.stdout.toString()}${badResult.stderr.toString()}`;

if (badResult.exitCode !== 1) {
    console.error(
        `Expected oxlint to exit with code 1, got ${badResult.exitCode}.`
    );
    console.error(badOutput);
    process.exit(1);
}

// JSON, so the checks do not depend on the reporter oxlint picks or on how it
// wraps long lines.
type Diagnostic = { readonly code: string; readonly message: string };
const diagnostics: readonly Diagnostic[] = (
    JSON.parse(badResult.stdout.toString()) as { diagnostics: Diagnostic[] }
).diagnostics;

for (const ruleId of expectedRuleIds) {
    if (!diagnostics.some((d) => d.code === ruleId)) {
        console.error(`Expected oxlint smoke output to include ${ruleId}.`);
        console.error(badOutput);
        process.exit(1);
    }
}

// Agents apply a message's `Fix:` as written, so each one is pinned here, built
// from the names in bad.ts.
const expectedFixes: Readonly<
    Record<(typeof expectedRuleIds)[number], string>
> = {
    "simplelog(prefer-runtime-entry)":
        'Fix: `"@murky-web/simplelog/node"` for the same Node logger, `"@murky-web/simplelog/bun"` for Bun, or `"@murky-web/simplelog/web"` for edge runtimes and browsers',
    "simplelog(require-logger-name)": 'Fix: `new Logger("bad")`',
    "simplelog(no-console-alias)":
        "Fix: delete it and call a SimpleLog logger: `logger.error(...)` in place of `error(...)`.",
    "simplelog(no-ad-hoc-console-fallback)":
        'Fix: `logger ?? new Logger("bad")` with `import { Logger } from "@murky-web/simplelog/node";`',
    "simplelog(prefer-child-logger)":
        'Fix: `logger.createChildLogger("request")`',
    "simplelog(prefer-hono-context-logger)":
        'Fix: `c.var.logger.info("bad")`, with `app.use(createHonoLoggerMiddleware({ logger: logger }))`',
    "simplelog(prefer-simplelog)": 'Fix: `logger.warn("oops")`'
};

for (const [ruleId, fix] of Object.entries(expectedFixes)) {
    if (
        !diagnostics.some((d) => d.code === ruleId && d.message.includes(fix))
    ) {
        console.error(`Expected the ${ruleId} message to contain: ${fix}`);
        console.error(badOutput);
        process.exit(1);
    }
}

const goodResult =
    await Bun.$`oxlint -c ${configPath.pathname} ${goodPath.pathname}`
        .nothrow()
        .quiet();
const goodOutput = `${goodResult.stdout.toString()}${goodResult.stderr.toString()}`;

if (goodResult.exitCode !== 0) {
    console.error("Expected valid simplelog integration to pass oxlint.");
    console.error(goodOutput);
    process.exit(1);
}

console.log("Simplelog oxlint smoke test passed.");
