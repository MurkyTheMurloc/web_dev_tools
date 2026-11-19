import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createLintHarness } from "./helpers.mjs";
import {
    importFixCases,
    importsSilentCases,
    importsSolidJsNames,
    noDestructureSilentCases,
} from "./import_cases.mjs";
import {
    READ_AFTER_GAP_MESSAGE,
    reactivityAsyncReportingCases,
    reactivityAsyncSilentCases,
} from "./reactivity_async_cases.mjs";
import {
    reactivityScopeReportingCases,
    reactivityScopeSilentCases,
} from "./reactivity_scope_cases.mjs";
import {
    expectedRuleIds,
    jsxUsesVarsCase,
    noDestructureFixCases,
    preferArrowDiagnosticCases,
    preferArrowFixCases,
    ruleCases,
} from "./rule_cases.mjs";

const EXIT_SUCCESS = 0;
const SOLID_LINT_CONFIG_PATH = "/config/oxc/linting/solid.jsonc";
let harness = null;
let solidPlugin = null;

function loadSolidPlugin() {
    return import(new URL("../src/index.mjs", import.meta.url).href);
}

function readSolidLintConfig(repoRoot) {
    return globalThis.Bun.file(`${repoRoot}${SOLID_LINT_CONFIG_PATH}`).text();
}

function registerFixTests() {
    [...preferArrowFixCases, ...noDestructureFixCases].forEach((fixCase) => {
        test(fixCase.name, async () => {
            const result = await harness.lint(fixCase.source, { fix: true });

            expect(result.source).toContain(fixCase.expectedFragment);
        });
    });
}

function countOccurrences(text, fragment) {
    return text.split(fragment).length - 1;
}

function registerImportFixTests() {
    importFixCases.forEach((fixCase) => {
        test(`fix: ${fixCase.name}`, async () => {
            // `runs` fix runs in a row, each on the output of the last.
            let result = { source: fixCase.source };
            for (let run = 0; run < (fixCase.runs ?? 1); run += 1) {
                result = await harness.lint(result.source, { fix: true });
            }
            if (fixCase.stable) {
                // Nothing left to fix: one more run changes nothing.
                const again = await harness.lint(result.source, { fix: true });

                expect(again.source).toBe(result.source);
            }

            for (const fragment of fixCase.expectedFragments ?? []) {
                expect(result.source).toContain(fragment);
            }
            for (const fragment of fixCase.forbiddenFragments ?? []) {
                expect(result.source).not.toContain(fragment);
            }
            for (const fragment of fixCase.singleFragments ?? []) {
                expect(countOccurrences(result.source, fragment)).toBe(1);
            }
        });
    });
}

function registerImportsRuleTests() {
    importsSolidJsNames.forEach((name) => {
        test(`imports: ${name} comes from solid-js`, async () => {
            const result = await harness.lint(
                `import { ${name} } from "@solidjs/web";\n\nexport const used = ${name};\n`,
            );

            expect(result.output).toContain(
                `Prefer importing ${name} from "solid-js".`,
            );
        });
    });

    importsSilentCases.forEach((silentCase) => {
        test(`imports: leaves ${silentCase.name} alone`, async () => {
            const result = await harness.lint(silentCase.source);

            expect(result.output).not.toContain("solid(imports)");
        });
    });
}

function registerNoDestructureSilentTests() {
    noDestructureSilentCases.forEach((silentCase) => {
        test(`no-destructure: leaves ${silentCase.name} alone`, async () => {
            const result = await harness.lint(silentCase.source);

            expect(result.output).not.toContain("solid(no-destructure)");
        });
    });
}

function registerPreferArrowDiagnosticTests() {
    preferArrowDiagnosticCases.forEach((diagCase) => {
        test(`prefer-arrow-components: ${diagCase.name}`, async () => {
            const result = await harness.lint(diagCase.source);

            expect(result.exitCode).toBeGreaterThan(0);
            expect(result.output).toContain("solid(prefer-arrow-components)");
        });
    });
}

function registerRuleDiagnosticsTests() {
    ruleCases.forEach((ruleCase) => {
        test(`reports ${ruleCase.ruleId}`, async () => {
            const result = await harness.lint(ruleCase.code, {
                fileName: ruleCase.fileName,
                files: ruleCase.files,
            });

            expect(result.exitCode).toBeGreaterThan(EXIT_SUCCESS);
            expect(result.output).toContain(`solid(${ruleCase.ruleId})`);
        });
    });
}

function registerReactivityAsyncTests() {
    reactivityAsyncReportingCases.forEach((asyncCase) => {
        test(`reactivity: ${asyncCase.name}`, async () => {
            const result = await harness.lint(asyncCase.code);

            expect(result.output).toContain(READ_AFTER_GAP_MESSAGE);
        });
    });

    reactivityAsyncSilentCases.forEach((asyncCase) => {
        test(`reactivity: ${asyncCase.name}`, async () => {
            const result = await harness.lint(asyncCase.code);

            expect(result.output).not.toContain("solid(reactivity)");
        });
    });
}

function registerReactivityScopeTests() {
    reactivityScopeReportingCases.forEach((scopeCase) => {
        test(`reactivity: ${scopeCase.name}`, async () => {
            const result = await harness.lint(scopeCase.code);

            expect(result.output).toContain(scopeCase.message);
        });
    });

    reactivityScopeSilentCases.forEach((scopeCase) => {
        test(`reactivity: ${scopeCase.name}`, async () => {
            const result = await harness.lint(scopeCase.code);

            expect(result.output).not.toContain("solid(reactivity)");
        });
    });
}

describe("oxlint-plugin-solid", () => {
    beforeAll(async () => {
        harness = await createLintHarness();
        solidPlugin = (await loadSolidPlugin()).default;
    });

    afterAll(async () => {
        await harness.cleanup();
    });

    test("exports every ported solid rule", () => {
        expect(Object.keys(solidPlugin.rules).toSorted()).toEqual(
            expectedRuleIds,
        );
    });

    test("solid config enables every ported rule", async () => {
        const configText = await readSolidLintConfig(harness.getRepoRoot());

        for (const ruleId of expectedRuleIds) {
            expect(configText).toContain(`"solid/${ruleId}"`);
        }
    });

    registerRuleDiagnosticsTests();
    registerPreferArrowDiagnosticTests();
    registerReactivityAsyncTests();
    registerReactivityScopeTests();
    registerImportsRuleTests();
    registerNoDestructureSilentTests();

    test("tracks JSX component usage so no-unused-vars stays quiet", async () => {
        const result = await harness.lint(jsxUsesVarsCase.code);

        expect(result.exitCode).toBe(EXIT_SUCCESS);
        expect(result.output).not.toContain("no-unused-vars");
    });

    registerFixTests();
    registerImportFixTests();
});
