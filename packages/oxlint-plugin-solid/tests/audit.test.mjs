import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
    importsFixes,
    nestingInsertedReports,
    nestingReports,
    nestingSilent,
    noDestructureFixes,
    noDestructureUnfixed,
    preferArrowFixes,
    preferArrowUnfixed,
    preferClassObjectFixes,
    preferClassObjectUnfixed,
    scriptUrlReports,
    scriptUrlSilent,
    serverImportBoundaryReports,
    serverImportBoundarySilent,
    serverImportReports,
    serverImportSilent,
} from "./audit_cases.mjs";
import { createLintHarness } from "./helpers.mjs";

const EXIT_SUCCESS = 0;
let harness = null;

function countOccurrences(text, fragment) {
    return text.split(fragment).length - 1;
}

function lintCase(auditCase) {
    return harness.lint(auditCase.code, {
        fileName: auditCase.fileName,
        files: auditCase.files,
    });
}

// `--fix` until nothing changes, at most `runs` times; the result of the last.
async function fixRuns(source, runs) {
    let result = { source, output: "" };
    for (let run = 0; run < runs; run += 1) {
        result = await harness.lint(result.source, { fix: true });
    }

    return result;
}

function registerReports(ruleId, reports, silent) {
    describe(`solid/${ruleId}`, () => {
        reports.forEach((auditCase) => {
            test(`reports ${auditCase.name}`, async () => {
                const result = await lintCase(auditCase);

                expect(result.exitCode).toBeGreaterThan(EXIT_SUCCESS);
                expect(result.output).toContain(`solid(${ruleId})`);
                if (auditCase.message !== undefined) {
                    expect(result.output).toContain(auditCase.message);
                }
            });
        });

        silent.forEach((auditCase) => {
            test(`allows ${auditCase.name}`, async () => {
                const result = await lintCase(auditCase);

                expect(result.output).not.toContain(`solid(${ruleId})`);
            });
        });
    });
}

function registerFixes(label, fixes) {
    describe(`${label} fix`, () => {
        fixes.forEach((fixCase) => {
            test(fixCase.name, async () => {
                const result = await fixRuns(fixCase.source, fixCase.runs ?? 1);

                for (const fragment of fixCase.expectedFragments ?? []) {
                    expect(result.source).toContain(fragment);
                }
                for (const fragment of fixCase.forbiddenFragments ?? []) {
                    expect(result.source).not.toContain(fragment);
                }
                for (const fragment of fixCase.singleFragments ?? []) {
                    expect(countOccurrences(result.source, fragment)).toBe(1);
                }
                if (fixCase.importBefore !== undefined) {
                    expect(
                        result.source.indexOf(
                            'import type { Component } from "solid-js";',
                        ),
                    ).toBeLessThan(result.source.indexOf(fixCase.importBefore));
                }
                // The written code parses and is valid TS under
                // verbatimModuleSyntax: no value in an `import type`
                // (TS1361), a type import marked `type` (the lint rule
                // consistent-type-imports stands in for TS1484), no `type`
                // inside `import type` (TS2206), no duplicate JSX attribute
                // (TS17001).
                const checked = await harness.lint(result.source);

                expect(checked.output).not.toMatch(
                    /TS(?:1109|1361|1363|1484|2206|17001)|consistent-type-imports|Unexpected token/u,
                );
                if (fixCase.stable) {
                    // Nothing left to fix: one more run changes nothing and
                    // leaves no report of the rule behind.
                    const again = await harness.lint(result.source, {
                        fix: true,
                    });

                    expect(again.source).toBe(result.source);
                    expect(again.output).not.toContain("solid(");
                }
            });
        });
    });
}

// Reported, but not fixed: the source stays as it was.
function registerUnfixed(label, cases) {
    describe(`${label} reports without a fix`, () => {
        cases.forEach((unfixedCase) => {
            test(unfixedCase.name, async () => {
                const result = await harness.lint(unfixedCase.source, {
                    fix: true,
                });

                expect(result.source).toBe(unfixedCase.source);
                expect(result.output).toContain(`solid(${unfixedCase.ruleId})`);
            });
        });
    });
}

describe("oxlint-plugin-solid audit fixes", () => {
    beforeAll(async () => {
        harness = await createLintHarness();
    });

    afterAll(async () => {
        await harness.cleanup();
    });

    registerReports("jsx-no-script-url", scriptUrlReports, scriptUrlSilent);
    registerReports(
        "validate-jsx-nesting",
        [...nestingReports, ...nestingInsertedReports],
        nestingSilent,
    );
    registerFixes("solid/prefer-arrow-components", preferArrowFixes);
    registerUnfixed("solid/prefer-arrow-components", preferArrowUnfixed);
    registerFixes("solid/no-destructure", noDestructureFixes);
    registerUnfixed("solid/no-destructure", noDestructureUnfixed);
    registerFixes("solid/imports", importsFixes);
    registerFixes("solid/prefer-class-object", preferClassObjectFixes);
    registerUnfixed("solid/prefer-class-object", preferClassObjectUnfixed);
    registerReports(
        "no-server-import-in-client",
        [...serverImportReports, ...serverImportBoundaryReports],
        [...serverImportSilent, ...serverImportBoundarySilent],
    );

    describe("solid/event-handlers", () => {
        test("does not suggest the removed attr: namespace", async () => {
            const result = await harness.lint(
                `export const View = () => <div onfoobar={() => {}} />;\n`,
            );

            expect(result.output).toContain("solid(event-handlers)");
            expect(result.output).not.toContain("attr:");
        });
    });
});
