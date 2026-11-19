import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { typebuddyOxlintPlugin } from "../oxlint/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// Where the autofixes put their imports, and where they must not put one.
// `output` is the file after one `--fix` pass (`null`: no autofix offered);
// `recursive` keeps fixing until nothing is left to fix.
const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: "ts" } },
});

const PACKAGE = "@murky-web/typebuddy";

type TesterRule = Parameters<RuleTester["run"]>[1];

function isTesterRule(value: unknown): value is TesterRule {
    return (
        typeof value === "object" &&
        value !== null &&
        "create" in value &&
        typeof value.create === "function"
    );
}

function pluginRule(ruleId: string): TesterRule {
    const rule = typebuddyOxlintPlugin.rules[ruleId];
    if (!isTesterRule(rule)) {
        throw new Error(`typebuddy/${ruleId} is not a rule with create()`);
    }

    return rule;
}

function lines(...rows: string[]): string {
    return rows.join("\n");
}

const TYPE_RULES = [
    {
        name: "prefer-maybe",
        typeName: "Maybe",
        union: "string | null",
        messageId: "useMaybe",
    },
    {
        name: "prefer-nullable",
        typeName: "Nullable",
        union: "string | null | undefined",
        messageId: "useNullable",
    },
    {
        name: "prefer-optional",
        typeName: "Optional",
        union: "string | undefined",
        messageId: "preferOptional",
    },
] as const;

describe.each(TYPE_RULES)("$name in files that cannot import", (entry) => {
    const { typeName, union, messageId } = entry;
    const written = `${typeName}<string>`;

    tester.run(entry.name, pluginRule(entry.name), {
        valid: [],
        invalid: [
            {
                name: "writes the global name in a script file and does not turn it into a module",
                filename: "vite-env.d.ts",
                code: lines(
                    "interface ImportMetaEnv {",
                    `    readonly VITE_KEY: ${union};`,
                    "}",
                ),
                errors: [{ messageId }],
                output: lines(
                    "interface ImportMetaEnv {",
                    `    readonly VITE_KEY: ${written};`,
                    "}",
                ),
            },
            {
                name: "does the same for a declared global variable",
                filename: "globals.d.ts",
                code: `declare var buildId: ${union};`,
                errors: [{ messageId }],
                output: `declare var buildId: ${written};`,
            },
            {
                name: "does the same for a declaration merged into Window",
                filename: "window.d.ts",
                code: lines("interface Window {", `    token: ${union};`, "}"),
                errors: [{ messageId }],
                output: lines(
                    "interface Window {",
                    `    token: ${written};`,
                    "}",
                ),
            },
            {
                name: "imports the type for declare global inside a module, which is a module already",
                code: lines(
                    "export {};",
                    "declare global {",
                    "    interface Window {",
                    `        token: ${union};`,
                    "    }",
                    "}",
                ),
                errors: [{ messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    "export {};",
                    "declare global {",
                    "    interface Window {",
                    `        token: ${written};`,
                    "    }",
                    "}",
                ),
            },
            {
                name: "imports the type for declare module inside a module",
                code: lines(
                    "export {};",
                    'declare module "some-library" {',
                    "    interface Options {",
                    `        token: ${union};`,
                    "    }",
                    "}",
                ),
                errors: [{ messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    "export {};",
                    'declare module "some-library" {',
                    "    interface Options {",
                    `        token: ${written};`,
                    "    }",
                    "}",
                ),
            },
            {
                name: "still imports the type in a normal module",
                code: lines(`export type Token = ${union};`),
                errors: [{ messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
        ],
    });
});

describe.each(TYPE_RULES)("$name merges and repeats imports", (entry) => {
    const { typeName, union, messageId } = entry;
    const written = `${typeName}<string>`;

    tester.run(entry.name, pluginRule(entry.name), {
        valid: [],
        invalid: [
            {
                name: "adds the name to an import type of the package",
                code: lines(
                    `import type { AsyncResult } from "${PACKAGE}";`,
                    `export type Token = ${union};`,
                ),
                errors: [{ messageId }],
                output: lines(
                    `import type { AsyncResult, ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
            {
                name: "adds the name as an inline type specifier to a value import",
                code: lines(
                    `import { isString } from "${PACKAGE}";`,
                    `export type Token = ${union};`,
                ),
                errors: [{ messageId }],
                output: lines(
                    `import { isString, type ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
            {
                name: "adds the name next to an inline type specifier of a value import",
                code: lines(
                    `import { type AsyncResult, isNumber } from "${PACKAGE}";`,
                    `export type Token = ${union};`,
                ),
                errors: [{ messageId }],
                output: lines(
                    `import { type AsyncResult, isNumber, type ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
            {
                name: "prefers an import type over a value import",
                code: lines(
                    `import { isString } from "${PACKAGE}";`,
                    `import type { AsyncResult } from "${PACKAGE}";`,
                    `export type Token = ${union};`,
                ),
                errors: [{ messageId }],
                output: lines(
                    `import { isString } from "${PACKAGE}";`,
                    `import type { AsyncResult, ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
            {
                name: "does not merge into an import of another module",
                code: lines(
                    'import { isString } from "other-library";',
                    `export type Token = ${union};`,
                ),
                errors: [{ messageId }],
                output: lines(
                    'import { isString } from "other-library";',
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    `export type Token = ${written};`,
                ),
            },
            {
                name: "one pass applies one fix with the import, and no fix is left without it",
                code: lines(
                    `export type A = ${union};`,
                    `export type B = ${union};`,
                ),
                errors: [{ messageId }, { messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    `export type A = ${written};`,
                    `export type B = ${union};`,
                ),
            },
            {
                name: "a second pass applies the rest on the import that is there now",
                code: lines(
                    `export type A = ${union};`,
                    `export type B = ${union};`,
                ),
                recursive: true,
                errors: [{ messageId }, { messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    `export type A = ${written};`,
                    `export type B = ${written};`,
                ),
            },
        ],
    });
});

describe("prefer-maybe-promise imports", () => {
    tester.run("prefer-maybe-promise", pluginRule("prefer-maybe-promise"), {
        valid: [],
        invalid: [
            {
                name: "adds ok to a value import of the result entry",
                code: lines(
                    `import { err } from "${PACKAGE}/result";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
                errors: [{ messageId: "returnVoidPromise" }],
                output: lines(
                    `import { err, ok } from "${PACKAGE}/result";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return ok();",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
            },
            {
                name: "does not add ok to a type-only import",
                code: lines(
                    `import type { Result } from "${PACKAGE}";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
                errors: [{ messageId: "returnVoidPromise" }],
                output: lines(
                    `import type { Result } from "${PACKAGE}";`,
                    `import { ok } from "${PACKAGE}";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return ok();",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
            },
            {
                name: "two fixes that need ok: one pass leaves nothing that uses ok without an import",
                code: lines(
                    "export async function one(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                    "export async function two(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
                errors: [
                    { messageId: "returnVoidPromise" },
                    { messageId: "returnVoidPromise" },
                ],
                output: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function one(): MaybePromise<void> {",
                    "    try {",
                    "        return ok();",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                    "export async function two(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
            },
            {
                name: "offers no value fix in a script file, which cannot import",
                filename: "script.ts",
                code: lines(
                    "async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}",
                ),
                errors: [{ messageId: "returnVoidPromise" }],
                output: null,
            },
            {
                name: "only suggests the Promise rename in a script file, where ok and err cannot follow",
                filename: "script.ts",
                code: lines(
                    "async function load(): Promise<string> {",
                    '    return "x";',
                    "}",
                ),
                errors: [
                    {
                        messageId: "replaceWithMaybePromise",
                        suggestions: [
                            {
                                messageId: "suggestMaybePromise",
                                output: lines(
                                    "async function load(): MaybePromise<string> {",
                                    '    return "x";',
                                    "}",
                                ),
                            },
                        ],
                    },
                ],
                output: null,
            },
        ],
    });
});
