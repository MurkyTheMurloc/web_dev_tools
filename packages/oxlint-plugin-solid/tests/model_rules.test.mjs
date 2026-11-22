import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createLintHarness } from "./helpers.mjs";
import {
    reactDepsReports,
    reactDepsSilent,
    reactiveAsyncReports,
    reactiveAsyncSilent,
    serverImportReports,
    serverImportSilent,
    strictVoidReports,
    strictVoidSilent
} from "./model_rule_cases.mjs";

const DEFAULT_FIXTURE = "src/model_case.tsx";
let harness = null;

function lintCase(modelCase, options = {}) {
    return harness.lint(modelCase.code, {
        fileName: modelCase.fileName ?? DEFAULT_FIXTURE,
        files: modelCase.files,
        ...options
    });
}

function registerRule(ruleId, reports, silent, message) {
    describe(`solid/${ruleId}`, () => {
        reports.forEach((modelCase) => {
            test(`reports ${modelCase.name}`, async () => {
                const result = await lintCase(modelCase);

                expect(result.output).toContain(`solid(${ruleId})`);
                expect(result.output).toContain(modelCase.message ?? message);
            });
            if (modelCase.fix !== undefined) {
                test(`--fix on ${modelCase.name}`, async () => {
                    const result = await lintCase(modelCase, { fix: true });

                    expect(result.source).toContain(modelCase.fix);
                });
            }
            if (modelCase.suggestion !== undefined) {
                test(`--fix-suggestions on ${modelCase.name}`, async () => {
                    const result = await lintCase(modelCase, {
                        flags: ["--fix-suggestions"]
                    });

                    expect(result.source).toContain(modelCase.suggestion);
                });
            }
        });

        silent.forEach((modelCase) => {
            test(`allows ${modelCase.name}`, async () => {
                const result = await lintCase(modelCase);

                expect(result.output).not.toContain(`solid(${ruleId})`);
            });
        });
    });
}

describe("model rules", () => {
    beforeAll(async () => {
        harness = await createLintHarness();
    });

    afterAll(async () => {
        await harness.cleanup();
    });

    registerRule(
        "reactive-async",
        reactiveAsyncReports,
        reactiveAsyncSilent,
        "async"
    );
    registerRule(
        "no-server-import-in-client",
        serverImportReports,
        serverImportSilent,
        "Fix: import a server function module instead"
    );
    registerRule(
        "no-react-deps",
        reactDepsReports,
        reactDepsSilent,
        "Solid 2.0"
    );
    registerRule(
        "strict-void-return",
        strictVoidReports,
        strictVoidSilent,
        "which Solid ignores"
    );
});
