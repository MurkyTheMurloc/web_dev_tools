import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createLintHarness } from "./helpers.mjs";
import {
    READ_AFTER_GAP_MESSAGE,
    reactivityAsyncReportingCases,
    reactivityAsyncSilentCases,
} from "./reactivity_async_cases.mjs";
import {
    expectedRuleIds,
    jsxUsesVarsCase,
    noDestructureFixCases,
    preferArrowDiagnosticCases,
    preferArrowFixCases,
    ruleCases,
} from "./rule_cases.mjs";

const EXIT_SUCCESS = 0;
const SOLID_LINT_CONFIG_PATH = "/packages/config/oxc/linting/solid.jsonc";
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
            const result = await harness.lint(ruleCase.code);

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

    test("tracks JSX component usage so no-unused-vars stays quiet", async () => {
        const result = await harness.lint(jsxUsesVarsCase.code);

        expect(result.exitCode).toBe(EXIT_SUCCESS);
        expect(result.output).not.toContain("no-unused-vars");
    });

    registerFixTests();
});
