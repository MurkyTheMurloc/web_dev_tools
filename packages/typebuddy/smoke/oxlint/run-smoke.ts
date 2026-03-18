const smokeDir = new URL("./", import.meta.url);
const configPath = new URL("./.oxlintrc.jsonc", smokeDir);
const violationsPath = new URL("./violations.ts", smokeDir);
const asyncViolationsPath = new URL("./async-violations.ts", smokeDir);

const expectedRuleIds = [
  "typebuddy(prefer-optional)",
  "typebuddy(prefer-maybe)",
  "typebuddy(prefer-nullable)",
  "typebuddy(prefer-maybe-promise)",
  "typebuddy(require-try-catch)",
] as const;

const result = await Bun.$`oxlint -c ${configPath.pathname} ${violationsPath.pathname} ${asyncViolationsPath.pathname}`.nothrow().quiet();
const output = `${result.stdout.toString()}${result.stderr.toString()}`;

if (result.exitCode !== 1) {
  console.error(`Expected oxlint to exit with code 1, got ${result.exitCode}.`);
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

const detectedRuleHits = expectedRuleIds.filter((ruleId) => output.includes(ruleId)).length;

if (detectedRuleHits !== expectedRuleIds.length) {
  console.error(`Expected oxlint smoke to report exactly ${expectedRuleIds.length} tracked rule hits, got ${detectedRuleHits}.`);
  console.error(output);
  process.exit(1);
}

console.log("Oxlint smoke test passed.");
