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

// Every diagnostic line starts with the path of its file.
function countDiagnostics(fileName: string): number {
    return output
        .split("\n")
        .filter((line) => line.includes(`${fileName}:`) && line.includes("error typebuddy("))
        .length;
}

// The files that must stay silent. (Checked by file name: oxlint prints paths
// relative to the working directory, so matching absolute paths never fires.)
const silent = {
    "deliberate-throw.ts":
        "a function that throws is not a result waiting to be wrapped",
    "framework-callback.ts": "framework callbacks are ignored by the async rules",
} as const;

for (const [fileName, reason] of Object.entries(silent)) {
    if (countDiagnostics(fileName) !== 0) {
        console.error(`Expected no typebuddy diagnostics in ${fileName}: ${reason}.`);
        console.error(output);
        process.exit(1);
    }
}

// The counter itself must see the violations, or every check above passes vacuously.
if (countDiagnostics("violations.ts") === 0) {
    console.error("Expected typebuddy diagnostics in violations.ts; the smoke check cannot see oxlint's output.");
    console.error(output);
    process.exit(1);
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
