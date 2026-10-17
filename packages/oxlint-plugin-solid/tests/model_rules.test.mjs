import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createLintHarness } from "./helpers.mjs";
import {
    reactiveAsyncReports,
    reactiveAsyncSilent,
    serverImportReports,
    serverImportSilent,
    strictVoidReports,
    strictVoidSilent,
} from "./model_rule_cases.mjs";

const DEFAULT_FIXTURE = "src/model_case.tsx";
let harness = null;

function lintCase(modelCase) {
    return harness.lint(modelCase.code, {
        fileName: modelCase.fileName ?? DEFAULT_FIXTURE,
        files: modelCase.files,
    });
}

function registerRule(ruleId, reports, silent, message) {
    describe(`solid/${ruleId}`, () => {
        reports.forEach((modelCase) => {
            test(`reports ${modelCase.name}`, async () => {
                const result = await lintCase(modelCase);

                expect(result.output).toContain(`solid(${ruleId})`);
                expect(result.output).toContain(
                    modelCase.message ?? message,
                );
            });
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
        "async",
    );
    registerRule(
        "no-server-import-in-client",
        serverImportReports,
        serverImportSilent,
        "Import a server function module instead",
    );
    registerRule(
        "strict-void-return",
        strictVoidReports,
        strictVoidSilent,
        "Solid ignores",
    );
});
