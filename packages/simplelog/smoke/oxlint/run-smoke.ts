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
    "simplelog(prefer-simplelog)",
] as const;

const badResult =
    await Bun.$`oxlint -c ${configPath.pathname} ${badPath.pathname}`
        .nothrow()
        .quiet();
const badOutput = `${badResult.stdout.toString()}${badResult.stderr.toString()}`;

if (badResult.exitCode !== 1) {
    console.error(
        `Expected oxlint to exit with code 1, got ${badResult.exitCode}.`,
    );
    console.error(badOutput);
    process.exit(1);
}

for (const ruleId of expectedRuleIds) {
    if (!badOutput.includes(ruleId)) {
        console.error(`Expected oxlint smoke output to include ${ruleId}.`);
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
