import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createLintHarness } from "./helpers.mjs";
import {
    importFixCases,
    importsSilentCases,
    importsSolidJsNames,
    noDestructureSilentCases
} from "./import_cases.mjs";
import {
    READ_AFTER_GAP_MESSAGE,
    reactivityAsyncReportingCases,
    reactivityAsyncSilentCases
} from "./reactivity_async_cases.mjs";
import {
    reactivityScopeReportingCases,
    reactivityScopeSilentCases
} from "./reactivity_scope_cases.mjs";
import {
    expectedRuleIds,
    jsxUsesVarsCase,
    namespaceCases,
    namespaceFixCases,
    noDestructureFixCases,
    preferArrowDiagnosticCases,
    preferArrowFixCases,
    preferDestructuringSilentCase,
    preferShowCases,
    ruleCases
} from "./rule_cases.mjs";

const EXIT_SUCCESS = 0;
const SOLID_LINT_CONFIG_PATH = "/packages/oxc-config/linting/solid.jsonc";
let harness = null;
let solidPlugin = null;

function loadSolidPlugin() {
    return import(new URL("../src/index.mjs", import.meta.url).href);
}

function readSolidLintConfig(repoRoot) {
    return readFile(`${repoRoot}${SOLID_LINT_CONFIG_PATH}`, "utf8");
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
                `import { ${name} } from "@solidjs/web";\n\nexport const used = ${name};\n`
            );

            expect(result.output).toContain(
                `Prefer importing ${name} from "solid-js".`
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

function registerPreferDestructuringSilentTest() {
    test("prefer-destructuring: stays silent on props and stores", async () => {
        const result = await harness.lint(preferDestructuringSilentCase.code);

        expect(result.output).not.toContain("solid(prefer-destructuring)");
    });
}

function registerRuleDiagnosticsTests() {
    ruleCases.forEach((ruleCase) => {
        test(`reports ${ruleCase.ruleId}`, async () => {
            const result = await harness.lint(ruleCase.code, {
                fileName: ruleCase.fileName,
                files: ruleCase.files,
                rules: ruleCase.rules
            });

            expect(result.exitCode).toBeGreaterThan(EXIT_SUCCESS);
            expect(result.output).toContain(`solid(${ruleCase.ruleId})`);
        });
    });
}

const NAMESPACE_RULE = "solid(no-unknown-namespaces)";

function registerNamespaceTests() {
    namespaceCases.forEach((namespaceCase) => {
        test(`no-unknown-namespaces: ${namespaceCase.name}`, async () => {
            const result = await harness.lint(namespaceCase.code, {
                rules: namespaceCase.rules
            });

            if (namespaceCase.report === null) {
                expect(result.output).not.toContain(NAMESPACE_RULE);
            } else {
                expect(result.output).toContain(
                    `${NAMESPACE_RULE}: ${namespaceCase.report}`
                );
            }
        });
    });

    namespaceFixCases.forEach((fixCase) => {
        test(`no-unknown-namespaces: every fix and suggestion leaves ${fixCase.name} alone`, async () => {
            const result = await harness.lint(fixCase.code, {
                fix: true,
                flags: ["--fix-suggestions", "--fix-dangerously"],
                rules: fixCase.rules
            });

            expect(result.source).toContain("<Island client:visible />");
            expect(result.source).toBe(fixCase.code);
        });
    });
}

const PREFER_SHOW_RULE = "solid(prefer-show)";

function registerPreferShowTests() {
    preferShowCases.forEach((showCase) => {
        test(`prefer-show: ${showCase.name}`, async () => {
            const result = await harness.lint(showCase.code);

            if (showCase.report === null) {
                expect(result.output).not.toContain(PREFER_SHOW_RULE);
            } else {
                expect(result.output).toContain(showCase.report);
            }
        });
        if (showCase.fix !== undefined) {
            test(`prefer-show: --fix on ${showCase.name}`, async () => {
                const result = await harness.lint(showCase.code, { fix: true });

                if (showCase.fix === null) {
                    expect(result.source).toBe(showCase.code);
                } else {
                    expect(result.source).toContain(showCase.fix);
                }
            });
        }
        if (showCase.suggestion !== undefined) {
            test(`prefer-show: --fix-suggestions on ${showCase.name}`, async () => {
                const result = await harness.lint(showCase.code, {
                    flags: ["--fix-suggestions"]
                });

                expect(result.source).toContain(showCase.suggestion);
            });
        }
    });
}

function registerReactivityAsyncTests() {
    reactivityAsyncReportingCases.forEach((asyncCase) => {
        test(`reactive-async: ${asyncCase.name}`, async () => {
            const result = await harness.lint(asyncCase.code);

            expect(result.output).toContain(READ_AFTER_GAP_MESSAGE);
            // Reported once, by reactive-async; reactivity stays out of it.
            expect(result.output).not.toContain("solid(reactivity)");
        });
    });

    reactivityAsyncSilentCases.forEach((asyncCase) => {
        test(`reactive-async: ${asyncCase.name}`, async () => {
            const result = await harness.lint(asyncCase.code);

            expect(result.output).not.toContain("solid(reactivity)");
            expect(result.output).not.toContain("solid(reactive-async)");
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
            expectedRuleIds
        );
    });

    test("solid config enables every ported rule", async () => {
        const configText = await readSolidLintConfig(harness.getRepoRoot());

        for (const ruleId of expectedRuleIds) {
            expect(configText).toContain(`"solid/${ruleId}"`);
        }
    });

    registerRuleDiagnosticsTests();
    registerPreferDestructuringSilentTest();
    registerNamespaceTests();
    registerPreferShowTests();
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
