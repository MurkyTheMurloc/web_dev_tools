const smokeDir = new URL("./", import.meta.url);
const configPath = new URL("./.oxlintrc.jsonc", smokeDir);
const violationsPath = new URL("./violations.ts", smokeDir);
const asyncViolationsPath = new URL("./async-violations.ts", smokeDir);
const frameworkCallbackPath = new URL("./framework-callback.ts", smokeDir);
const deliberateThrowPath = new URL("./deliberate-throw.ts", smokeDir);
const useServerModulePath = new URL("./use-server-module.ts", smokeDir);
const useServerFunctionPath = new URL("./use-server-function.ts", smokeDir);
const useServerSiblingPath = new URL("./use-server-sibling.ts", smokeDir);

const expectedRuleIds = [
    "typebuddy(prefer-optional)",
    "typebuddy(prefer-maybe)",
    "typebuddy(prefer-nullable)",
    "typebuddy(prefer-maybe-promise)",
    "typebuddy(require-try-catch)",
] as const;

const result =
    await Bun.$`oxlint -c ${configPath.pathname} ${violationsPath.pathname} ${asyncViolationsPath.pathname} ${frameworkCallbackPath.pathname} ${deliberateThrowPath.pathname} ${useServerModulePath.pathname} ${useServerFunctionPath.pathname} ${useServerSiblingPath.pathname}`
        .nothrow()
        .quiet();
const output = `${result.stdout.toString()}${result.stderr.toString()}`;

if (result.exitCode !== 1) {
    console.error(
        `Expected oxlint to exit with code 1, got ${result.exitCode}.`,
    );
    console.error(output);
    process.exit(1);
}

for (const ruleId of expectedRuleIds) {
    if (!output.includes(ruleId)) {
        console.error(`Expected oxlint smoke output to include ${ruleId}.`);
        console.error(output);
        process.exit(1);
    }
}

const detectedRuleHits = expectedRuleIds.filter((ruleId) =>
    output.includes(ruleId),
).length;

if (detectedRuleHits !== expectedRuleIds.length) {
    console.error(
        `Expected oxlint smoke to report exactly ${expectedRuleIds.length} tracked rule hits, got ${detectedRuleHits}.`,
    );
    console.error(output);
    process.exit(1);
}

if (output.includes(frameworkCallbackPath.pathname)) {
    console.error(
        "Expected framework callback smoke file to be ignored by async typebuddy rules.",
    );
    console.error(output);
    process.exit(1);
}

if (output.includes(deliberateThrowPath.pathname)) {
    console.error(
        "Expected a function that throws to be ignored by async typebuddy rules: a deliberate throw is not a result waiting to be wrapped.",
    );
    console.error(output);
    process.exit(1);
}

// Every diagnostic line starts with the path of its file.
function countDiagnostics(fileName: string): number {
    return output
        .split("\n")
        .filter((line) => line.includes(`${fileName}:`) && line.includes("error typebuddy("))
        .length;
}

for (const fileName of ["use-server-module.ts", "use-server-function.ts"]) {
    if (countDiagnostics(fileName) !== 0) {
        console.error(
            `Expected ${fileName} to be ignored by async typebuddy rules: "use server" code logs and throws instead of returning results.`,
        );
        console.error(output);
        process.exit(1);
    }
}

// One diagnostic per rule for the sibling, none for the function with the
// directive.
const siblingHits = countDiagnostics("use-server-sibling.ts");
if (siblingHits !== 2) {
    console.error(
        `Expected exactly 2 diagnostics for the function without "use server" next to one with it, got ${siblingHits}.`,
    );
    console.error(output);
    process.exit(1);
}

console.log("Oxlint smoke test passed.");
