import { describe, expect, expectTypeOf, it } from "vitest";

import { typebuddyOxlintPlugin } from "../oxlint/index.js";
import { maybeRule } from "../rules/maybe_rule.js";
import { isTestFile, withoutTestFiles } from "../rules/test_file.js";

type Visitors = Record<string, unknown>;
type CreatableRule = { create(context: unknown): Visitors };

const RULE_IDS = [
    "prefer-maybe",
    "prefer-maybe-promise",
    "prefer-nullable",
    "prefer-optional",
    "require-try-catch"
] as const;

const SOURCE_FILES = [
    "src/x.ts",
    "src/latest.ts",
    "src/contest.ts",
    "/repo/src/attest.tsx"
];

const TEST_FILES = [
    "src/x.test.ts",
    "src/x.spec.tsx",
    "src/x.bench.ts",
    "src/x.test.d.ts",
    "tests/helper.ts",
    "test/helper.ts",
    "src/__tests__/x.ts",
    "src/__mocks__/x.ts",
    "vitest.setup.ts",
    "config/vitest-setup.mts",
    "src/setupTests.ts"
];

function isCreatableRule(value: unknown): value is CreatableRule {
    return (
        typeof value === "object" &&
        value !== null &&
        "create" in value &&
        typeof value.create === "function"
    );
}

function visitorsFor(ruleId: string, filename: string, cwd?: string): Visitors {
    const rule = typebuddyOxlintPlugin.rules[ruleId];
    if (!isCreatableRule(rule)) {
        throw new Error(`typebuddy/${ruleId} is not a rule with create()`);
    }
    return rule.create({
        cwd,
        filename,
        getSourceCode: () => ({ getText: () => "" }),
        report: () => undefined
    });
}

describe("isTestFile", () => {
    it.each(TEST_FILES)("treats %s as a test file", (filename) => {
        expect(isTestFile(filename)).toBe(true);
    });

    it.each(SOURCE_FILES)("does not treat %s as a test file", (filename) => {
        expect(isTestFile(filename)).toBe(false);
    });

    it("does not treat a directory that merely contains test in its name as a test directory", () => {
        expect(isTestFile("src/latest/x.ts")).toBe(false);
        expect(isTestFile("src/testing/x.ts")).toBe(false);
    });

    describe("with the project's working directory", () => {
        it("ignores test directories above the project", () => {
            expect(isTestFile("/tmp/test/app/src/x.ts", "/tmp/test/app")).toBe(
                false
            );
            expect(
                isTestFile(
                    "/work/__tests__/app/src/x.ts",
                    "/work/__tests__/app"
                )
            ).toBe(false);
            expect(
                isTestFile(
                    "/repo/.worktrees/tests/app/src/x.ts",
                    "/repo/.worktrees/tests/app/"
                )
            ).toBe(false);
        });

        it("matches test directories inside the project", () => {
            expect(
                isTestFile("/tmp/test/app/tests/helper.ts", "/tmp/test/app")
            ).toBe(true);
            expect(
                isTestFile("/repo/packages/a/tests/deep/helper.ts", "/repo")
            ).toBe(true);
            expect(isTestFile("/repo/src/__mocks__/x.ts", "/repo/")).toBe(true);
            expect(
                isTestFile("C:\\repo\\src\\__tests__\\x.ts", "C:\\repo")
            ).toBe(true);
        });

        it("still matches by basename anywhere", () => {
            expect(
                isTestFile("/tmp/test/app/src/x.test.ts", "/tmp/test/app")
            ).toBe(true);
            expect(
                isTestFile("/elsewhere/src/x.spec.ts", "/tmp/test/app")
            ).toBe(true);
            expect(
                isTestFile("/elsewhere/vitest.setup.ts", "/tmp/test/app")
            ).toBe(true);
        });

        it("matches a file outside the project by basename only", () => {
            expect(
                isTestFile("/elsewhere/tests/helper.ts", "/tmp/test/app")
            ).toBe(false);
            expect(
                isTestFile(
                    "/tmp/test/app-other/tests/helper.ts",
                    "/tmp/test/app"
                )
            ).toBe(false);
        });

        it("matches an absolute file by basename only when there is no working directory", () => {
            expect(isTestFile("/tmp/test/app/src/x.ts")).toBe(false);
            expect(isTestFile("/tmp/test/app/tests/helper.ts")).toBe(false);
            expect(isTestFile("/tmp/test/app/src/x.test.ts")).toBe(true);
        });
    });
});

describe("typebuddy oxlint rules in test files", () => {
    it("registers every rule this suite checks", () => {
        expect(
            Object.keys(typebuddyOxlintPlugin.rules).toSorted()
        ).toStrictEqual([...RULE_IDS]);
    });

    describe.each(RULE_IDS)("%s", (ruleId) => {
        it.each(SOURCE_FILES)("visits nodes in %s", (filename) => {
            expect(
                Object.keys(visitorsFor(ruleId, filename)).length
            ).toBeGreaterThan(0);
        });

        it.each(TEST_FILES)("returns no visitors for %s", (filename) => {
            expect(visitorsFor(ruleId, filename)).toStrictEqual({});
        });
    });

    describe.each(RULE_IDS)("%s under a directory named test", (ruleId) => {
        const cwd = "/tmp/test/app";

        it("visits nodes in a source file", () => {
            expect(
                Object.keys(visitorsFor(ruleId, "/tmp/test/app/src/x.ts", cwd))
                    .length
            ).toBeGreaterThan(0);
        });

        it("returns no visitors for a test directory inside the project", () => {
            expect(
                visitorsFor(ruleId, "/tmp/test/app/tests/helper.ts", cwd)
            ).toStrictEqual({});
        });
    });

    it("matches only by basename for an absolute file when the context has no cwd", () => {
        expect(
            Object.keys(
                visitorsFor("prefer-maybe", "/tmp/test/app/tests/helper.ts")
            ).length
        ).toBeGreaterThan(0);
        expect(
            visitorsFor("prefer-maybe", "/tmp/test/app/src/x.test.ts")
        ).toStrictEqual({});
    });
});

describe("withoutTestFiles types", () => {
    const wrapped = withoutTestFiles(maybeRule);

    it("keeps the wrapped rule's context type", () => {
        expectTypeOf(wrapped.create)
            .parameter(0)
            .toEqualTypeOf<Parameters<typeof maybeRule.create>[0]>();
    });

    it("does not widen the context to any object", () => {
        expectTypeOf<
            Parameters<typeof wrapped.create>[0]
        >().not.toEqualTypeOf<object>();
    });

    it("keeps the rule's meta", () => {
        expectTypeOf(wrapped.meta).toEqualTypeOf<typeof maybeRule.meta>();
    });
});
