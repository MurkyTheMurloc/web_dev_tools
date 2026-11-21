import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { typebuddyOxlintPlugin } from "../oxlint/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// These run the rules, as the plugin registers them, through oxlint's own
// RuleTester: the real parser, the real scope manager, the real fixer.
// `output` is the file after the autofix (`null` means "no autofix is
// offered"); `suggestions` are the fixes the user has to pick.
const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: "ts" } }
});

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

const PACKAGE = "@murky-web/typebuddy";

function lines(...rows: string[]): string {
    return rows.join("\n");
}

describe("prefer-maybe-promise", () => {
    tester.run("prefer-maybe-promise", pluginRule("prefer-maybe-promise"), {
        valid: [
            {
                name: "leaves an async generator alone",
                code: lines(
                    "export async function* stream(): AsyncGenerator<number> {",
                    "    try {",
                    "        yield 1;",
                    "        return 2;",
                    "    } catch {",
                    "        return 3;",
                    "    }",
                    "}"
                )
            },
            {
                name: "does not touch an inline result object with more than isError and value",
                code: lines(
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return { isError: false, value: "x", note: "kept" };',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            }
        ],
        invalid: [
            {
                name: "does not call the caught value when the catch parameter is called err",
                code: lines(
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch (err) {",
                    "        console.error(err);",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnFailedPromise" }],
                output: null
            },
            {
                name: "does not call a catch parameter in a catch that returns nothing",
                code: lines(
                    "export async function load(): MaybePromise<void> {",
                    "    try {",
                    "        return ok();",
                    "    } catch (err) {",
                    "        return;",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnFailedPromise" }],
                output: null
            },
            {
                name: "does not add a second err import when ok and err come from the result entry",
                code: lines(
                    `import { err, ok } from "${PACKAGE}/result";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        log();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnFailedPromise" }],
                output: lines(
                    `import { err, ok } from "${PACKAGE}/result";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        log();",
                    "    ",
                    "return err();",
                    "}",
                    "}"
                )
            },
            {
                name: "adds the err import after a use client directive, not above it",
                code: lines(
                    '"use client";',
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        log();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnFailedPromise" }],
                output: lines(
                    '"use client";',
                    `import { err } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        log();",
                    "    ",
                    "return err();",
                    "}",
                    "}"
                )
            },
            {
                name: "only suggests ok() for a returned value that may already be a failed result",
                code: lines(
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    "        const session = await readSession();",
                    "        return session;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        messageId: "wrapReturn",
                        suggestions: [
                            {
                                messageId: "suggestWrapReturn",
                                output: lines(
                                    `import { ok } from "${PACKAGE}";`,
                                    "export async function load(): MaybePromise<string> {",
                                    "    try {",
                                    "        const session = await readSession();",
                                    "        return ok(session);",
                                    "    } catch {",
                                    "        return err();",
                                    "    }",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "only suggests ok() for a call that already returns a MaybePromise",
                code: lines(
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    "        return await loadSession();",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        messageId: "wrapReturn",
                        suggestions: [
                            {
                                messageId: "suggestWrapReturn",
                                output: lines(
                                    `import { ok } from "${PACKAGE}";`,
                                    "export async function load(): MaybePromise<string> {",
                                    "    try {",
                                    "        return ok(await loadSession());",
                                    "    } catch {",
                                    "        return err();",
                                    "    }",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "offers no ok() suggestion where ok is a local variable",
                code: lines(
                    "export async function load(res: Response): MaybePromise<boolean> {",
                    "    try {",
                    "        const ok = res.ok;",
                    "        return ok;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "wrapReturn", suggestions: [] }],
                output: null
            },
            {
                name: "rewrites a bare return in a void function and imports ok",
                code: lines(
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnVoidPromise" }],
                output: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return ok();",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            },
            {
                name: "does not rewrite a bare return where ok is a parameter",
                code: lines(
                    "export async function run(ok: boolean): MaybePromise<void> {",
                    "    try {",
                    "        return;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnVoidPromise" }],
                output: null
            },
            {
                name: "rewrites the Promise return type of the file's own async function and imports MaybePromise",
                code: lines(
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [{ messageId: "replaceWithMaybePromise" }],
                output: lines(
                    `import type { MaybePromise } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    '    return ok("x");',
                    "}"
                )
            },
            {
                name: "does not import MaybePromise a second time",
                code: lines(
                    `import type { MaybePromise } from "${PACKAGE}";`,
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [{ messageId: "replaceWithMaybePromise" }],
                output: lines(
                    `import type { MaybePromise } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    '    return ok("x");',
                    "}"
                )
            },
            {
                name: "does not rewrite to another library's MaybePromise",
                code: lines(
                    'import type { MaybePromise } from "some-other-library";',
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [{ messageId: "replaceWithMaybePromise" }],
                output: null
            },
            {
                name: "only suggests MaybePromise for an interface method",
                code: lines(
                    "export interface Loader {",
                    "    load(): Promise<string>;",
                    "}"
                ),
                errors: [
                    {
                        messageId: "replaceWithMaybePromise",
                        suggestions: [
                            {
                                messageId: "suggestMaybePromise",
                                output: lines(
                                    `import type { MaybePromise } from "${PACKAGE}";`,
                                    "export interface Loader {",
                                    "    load(): MaybePromise<string>;",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "only suggests MaybePromise for a function type",
                code: "export type LoadFn = () => Promise<string>;",
                errors: [
                    {
                        messageId: "replaceWithMaybePromise",
                        suggestions: [
                            {
                                messageId: "suggestMaybePromise",
                                output: lines(
                                    `import type { MaybePromise } from "${PACKAGE}";`,
                                    "export type LoadFn = () => MaybePromise<string>;"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "still rewrites an inline success object that is exactly isError and value",
                code: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return { isError: false, value: "x" };',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "preferOkResult" }],
                output: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            }
        ]
    });
});

describe("require-try-catch", () => {
    tester.run("require-try-catch", pluginRule("require-try-catch"), {
        valid: [
            {
                name: "leaves an async generator alone",
                code: lines(
                    "export async function* stream() {",
                    "    yield 1;",
                    "}"
                )
            }
        ],
        invalid: [
            {
                name: "suggests the wrap, never applies it",
                code: lines(
                    "export async function load() {",
                    '    return "x";',
                    "}"
                ),
                errors: [
                    {
                        messageId: "missingTryCatch",
                        suggestions: [
                            {
                                messageId: "suggestTryCatch",
                                output: lines(
                                    `import { err } from "${PACKAGE}";`,
                                    "export async function load() {",
                                    "try {",
                                    '    return "x";',
                                    "} catch {",
                                    "return err();",
                                    "}",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "keeps use cache a directive by putting try after it",
                code: lines(
                    "export async function load() {",
                    '    "use cache";',
                    '    return "x";',
                    "}"
                ),
                errors: [
                    {
                        messageId: "missingTryCatch",
                        suggestions: [
                            {
                                messageId: "suggestTryCatch",
                                output: lines(
                                    `import { err } from "${PACKAGE}";`,
                                    "export async function load() {",
                                    '    "use cache";',
                                    "try {",
                                    '    return "x";',
                                    "} catch {",
                                    "return err();",
                                    "}",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "puts the import after a use client directive",
                code: lines(
                    '"use client";',
                    "export async function load() {",
                    '    return "x";',
                    "}"
                ),
                errors: [
                    {
                        messageId: "missingTryCatch",
                        suggestions: [
                            {
                                messageId: "suggestTryCatch",
                                output: lines(
                                    '"use client";',
                                    `import { err } from "${PACKAGE}";`,
                                    "export async function load() {",
                                    "try {",
                                    '    return "x";',
                                    "} catch {",
                                    "return err();",
                                    "}",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "accepts err imported from the result entry",
                code: lines(
                    `import { err } from "${PACKAGE}/result";`,
                    "export async function load() {",
                    '    return "x";',
                    "}"
                ),
                errors: [
                    {
                        messageId: "missingTryCatch",
                        suggestions: [
                            {
                                messageId: "suggestTryCatch",
                                output: lines(
                                    `import { err } from "${PACKAGE}/result";`,
                                    "export async function load() {",
                                    "try {",
                                    '    return "x";',
                                    "} catch {",
                                    "return err();",
                                    "}",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "offers no suggestion where err is a parameter",
                code: lines(
                    "export async function load(err: Error) {",
                    "    return err.message;",
                    "}"
                ),
                errors: [{ messageId: "missingTryCatch", suggestions: [] }],
                output: null
            },
            {
                name: "suggests a block for an expression-bodied arrow",
                code: "export const load = async () => await fetchName();",
                errors: [
                    {
                        messageId: "missingTryCatch",
                        suggestions: [
                            {
                                messageId: "suggestTryCatch",
                                output: lines(
                                    `import { err } from "${PACKAGE}";`,
                                    "export const load = async () => {",
                                    "try {",
                                    "return await fetchName();",
                                    "} catch {",
                                    "return err();",
                                    "}",
                                    "};"
                                )
                            }
                        ]
                    }
                ],
                output: null
            }
        ]
    });
});

const TYPE_RULES = [
    {
        name: "prefer-maybe",
        typeName: "Maybe",
        union: "string | null",
        messageId: "useMaybe"
    },
    {
        name: "prefer-nullable",
        typeName: "Nullable",
        union: "string | null | undefined",
        messageId: "useNullable"
    },
    {
        name: "prefer-optional",
        typeName: "Optional",
        union: "string | undefined",
        messageId: "preferOptional"
    }
] as const;

describe.each(TYPE_RULES)("$name imports the type it rewrites to", (entry) => {
    const { typeName, union, messageId } = entry;
    const declaration = `export type Name = ${union};`;
    const rewritten = `export type Name = ${typeName}<string>;`;

    tester.run(entry.name, pluginRule(entry.name), {
        valid: [
            {
                name: `leaves a file alone where ${typeName} is another library's type`,
                code: lines(
                    `import type { ${typeName} } from "graphql";`,
                    "export type Other = number;"
                )
            }
        ],
        invalid: [
            {
                name: "adds the type import before the first statement",
                code: declaration,
                errors: [{ messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    rewritten
                )
            },
            {
                name: "adds the type import after the last import",
                code: lines('import { x } from "./x.js";', declaration),
                errors: [{ messageId }],
                output: lines(
                    'import { x } from "./x.js";',
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    rewritten
                )
            },
            {
                name: "adds the type import after a use client directive",
                code: lines('"use client";', declaration),
                errors: [{ messageId }],
                output: lines(
                    '"use client";',
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    rewritten
                )
            },
            {
                name: "does not import it twice",
                code: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    declaration
                ),
                errors: [{ messageId }],
                output: lines(
                    `import type { ${typeName} } from "${PACKAGE}";`,
                    rewritten
                )
            },
            {
                name: "does not rewrite to another library's type of the same name",
                code: lines(
                    `import type { ${typeName} } from "graphql";`,
                    declaration
                ),
                errors: [{ messageId }],
                output: null
            },
            {
                name: "does not rewrite where the name is a local type",
                code: lines(`type ${typeName}<T> = T[];`, declaration),
                errors: [{ messageId }],
                output: null
            }
        ]
    });
});
