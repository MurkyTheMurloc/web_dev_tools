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

/**
 * Matches a message that contains every given piece, in order. Messages are
 * read by agents that apply the `Fix:` as written, so the tests pin it.
 */
function messageWith(...pieces: string[]): RegExp {
    const escaped = pieces.map((piece) =>
        piece.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    );
    return new RegExp(escaped.join("[\\s\\S]*"), "u");
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
            },
            {
                name: "allows propagating a narrowed error result with isErr or isError inside try",
                code: lines(
                    `import { err, isErr, ok } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string, string> {",
                    "    try {",
                    "        const res = await loadInner();",
                    "        if (isErr(res)) return res;",
                    "        if (res.isError) return res;",
                    "        return ok(res.value);",
                    "    } catch {",
                    '        return err("failed");',
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
                errors: [
                    {
                        message: messageWith(
                            "settles on nothing (it has no `return`) instead of `err()`",
                            `Fix: end the \`catch\` with \`return err();\` (or a typed \`return err(error);\`) and \`import { err } from "${PACKAGE}";\`, renaming a \`catch (err)\` parameter first`,
                            "Do not return `ok(...)` from the `catch`."
                        )
                    }
                ],
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
                errors: [
                    {
                        message: messageWith(
                            "settles on `return;` instead of `err()`",
                            "Fix: end the `catch` with `return err();`"
                        )
                    }
                ],
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
                        message: messageWith(
                            "`return session` in the `try`",
                            "Fix: `return ok(session)`; if `session` already is a `Result`, unwrap it: `const settled = session; if (settled.isError) return err(settled.value); return ok(settled.value);`.",
                            "Do not cast it with `as`."
                        ),
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
                errors: [
                    {
                        message: messageWith(
                            "`return;` in the `try` of an async `void` function",
                            `Fix: \`return ok();\` with \`import { ok } from "${PACKAGE}";\``
                        )
                    }
                ],
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
                name: "rewrites the Promise return type of the file's own async function and imports AsyncResult",
                code: lines(
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [
                    {
                        message: messageWith(
                            "`Promise<string>` makes a failure a rejection",
                            `Fix: \`AsyncResult<string>\` with \`import type { AsyncResult } from "${PACKAGE}";\`, then \`return ok(value)\` from the \`try\` and \`return err()\` (or a typed \`return err(error)\`) from the \`catch\`.`,
                            "Do not cast the returns with `as`"
                        )
                    }
                ],
                output: lines(
                    `import type { AsyncResult } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string> {",
                    '    return ok("x");',
                    "}"
                )
            },
            {
                name: "does not import AsyncResult a second time",
                code: lines(
                    `import type { AsyncResult } from "${PACKAGE}";`,
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [{ messageId: "replaceWithMaybePromise" }],
                output: lines(
                    `import type { AsyncResult } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string> {",
                    '    return ok("x");',
                    "}"
                )
            },
            {
                name: "does not rewrite to another library's AsyncResult",
                code: lines(
                    'import type { AsyncResult } from "some-other-library";',
                    "export async function load(): Promise<string> {",
                    '    return ok("x");',
                    "}"
                ),
                errors: [{ messageId: "replaceWithMaybePromise" }],
                output: null
            },
            {
                name: "only suggests AsyncResult for an interface method",
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
                                    `import type { AsyncResult } from "${PACKAGE}";`,
                                    "export interface Loader {",
                                    "    load(): AsyncResult<string>;",
                                    "}"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "only suggests AsyncResult for a function type",
                code: "export type LoadFn = () => Promise<string>;",
                errors: [
                    {
                        messageId: "replaceWithMaybePromise",
                        suggestions: [
                            {
                                messageId: "suggestMaybePromise",
                                output: lines(
                                    `import type { AsyncResult } from "${PACKAGE}";`,
                                    "export type LoadFn = () => AsyncResult<string>;"
                                )
                            }
                        ]
                    }
                ],
                output: null
            },
            {
                name: "does not autofix missing catch return to bare err() when AsyncResult declares a typed error E",
                code: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string, string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        log();",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "returnFailedPromise" }],
                output: null
            },
            {
                name: "rewrites an inline typed failed object in a catch to err(error)",
                code: lines(
                    `import { err, ok } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string, string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    '        return { isError: true, value: "boom" };',
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        message: messageWith(
                            '`{ isError: true, value: "boom" }` builds the failed result by hand',
                            `Fix: \`err("boom")\` with \`import { err } from "${PACKAGE}";\``
                        )
                    }
                ],
                output: lines(
                    `import { err, ok } from "${PACKAGE}";`,
                    "export async function load(): AsyncResult<string, string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    '        return err("boom");',
                    "    }",
                    "}"
                )
            },
            {
                name: "rewrites an inline failed object in a catch to err()",
                code: lines(
                    `import { err, ok } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return { isError: true, value: null };",
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        message: messageWith(
                            "`{ isError: true, value: null }` builds the failed result by hand",
                            `Fix: \`err()\` with \`import { err } from "${PACKAGE}";\``
                        )
                    }
                ],
                output: lines(
                    `import { err, ok } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
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
                errors: [
                    {
                        message: messageWith(
                            '`{ isError: false, value: "x" }` builds the success result by hand',
                            `Fix: \`ok("x")\` with \`import { ok } from "${PACKAGE}";\``
                        )
                    }
                ],
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

// `FAILED_PROMISE` and `VOID_PROMISE` were globals of an older typebuddy. They
// are gone, so a reference to one throws a `ReferenceError` wherever it sits —
// a framework callback the rest of the rule leaves alone included.
describe("prefer-maybe-promise: removed result globals", () => {
    tester.run("prefer-maybe-promise", pluginRule("prefer-maybe-promise"), {
        valid: [
            {
                name: "leaves a FAILED_PROMISE the file defines itself alone",
                code: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "const FAILED_PROMISE = { isError: true, value: null } as const;",
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return FAILED_PROMISE;",
                    "    }",
                    "}"
                )
            },
            {
                name: "leaves a VOID_PROMISE parameter alone",
                code: lines(
                    `import { err } from "${PACKAGE}";`,
                    "export async function run(VOID_PROMISE: Success<void>): MaybePromise<void> {",
                    "    try {",
                    "        return VOID_PROMISE;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            },
            {
                name: "leaves property names that only look like the globals alone",
                code: lines(
                    "export const results = { FAILED_PROMISE: 1, VOID_PROMISE: 2 };",
                    "export const failed = results.FAILED_PROMISE;"
                )
            }
        ],
        invalid: [
            {
                name: "rewrites FAILED_PROMISE in a catch to err() and imports err",
                code: lines(
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return FAILED_PROMISE;",
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        message: messageWith(
                            "`FAILED_PROMISE` does not exist at runtime",
                            "throws a `ReferenceError`",
                            `Fix: \`err()\` with \`import { err } from "${PACKAGE}";\``,
                            "Do not declare `FAILED_PROMISE` yourself"
                        )
                    }
                ],
                output: lines(
                    `import { err } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            },
            {
                name: "joins err to an existing import from the result entry",
                code: lines(
                    `import { ok } from "${PACKAGE}/result";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return FAILED_PROMISE;",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "removedResultGlobal" }],
                output: lines(
                    `import { ok, err } from "${PACKAGE}/result";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                )
            },
            {
                name: "rewrites VOID_PROMISE in a try to ok() and keeps the ok import",
                code: lines(
                    `import { err, ok } from "${PACKAGE}";`,
                    "export async function run(): MaybePromise<void> {",
                    "    try {",
                    "        return VOID_PROMISE;",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "}"
                ),
                errors: [
                    {
                        message: messageWith(
                            "`VOID_PROMISE` does not exist at runtime",
                            `Fix: \`ok()\` with \`import { ok } from "${PACKAGE}";\``
                        )
                    }
                ],
                output: lines(
                    `import { err, ok } from "${PACKAGE}";`,
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
                name: "rewrites FAILED_PROMISE in a framework callback the other checks skip",
                code: lines(
                    `import { err } from "${PACKAGE}";`,
                    "app.use(async (c, next) => {",
                    "    try {",
                    "        await run(c, () => {",
                    "            try {",
                    "                return next();",
                    "            } catch {",
                    "                return FAILED_PROMISE;",
                    "            }",
                    "        });",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "});"
                ),
                errors: [{ messageId: "removedResultGlobal" }],
                output: lines(
                    `import { err } from "${PACKAGE}";`,
                    "app.use(async (c, next) => {",
                    "    try {",
                    "        await run(c, () => {",
                    "            try {",
                    "                return next();",
                    "            } catch {",
                    "                return err();",
                    "            }",
                    "        });",
                    "    } catch {",
                    "        return err();",
                    "    }",
                    "});"
                )
            },
            {
                name: "rewrites FAILED_PROMISE outside a return too",
                code: lines(
                    `import { err } from "${PACKAGE}";`,
                    "export const fallback = FAILED_PROMISE;"
                ),
                errors: [{ messageId: "removedResultGlobal" }],
                output: lines(
                    `import { err } from "${PACKAGE}";`,
                    "export const fallback = err();"
                )
            },
            {
                name: "does not call a catch parameter named err",
                code: lines(
                    `import { ok } from "${PACKAGE}";`,
                    "export async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch (err) {",
                    "        return FAILED_PROMISE;",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "removedResultGlobal" }],
                output: null
            },
            {
                name: "reports without a fix in a script file that cannot take an import",
                code: lines(
                    "async function load(): MaybePromise<string> {",
                    "    try {",
                    '        return ok("x");',
                    "    } catch {",
                    "        return FAILED_PROMISE;",
                    "    }",
                    "}"
                ),
                errors: [{ messageId: "removedResultGlobal" }],
                output: null
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
            },
            {
                name: "accepts a direct fromPromise boundary return without outer try/catch",
                code: lines(
                    `import { fromPromise } from "${PACKAGE}/result";`,
                    "export async function load() {",
                    "    return fromPromise(fetchName(), (cause) => cause);",
                    "}"
                )
            },
            {
                name: "accepts an expression-bodied arrow delegating to withTimeout",
                code: lines(
                    `import { withTimeout } from "${PACKAGE}/async";`,
                    "export const load = async () => withTimeout((s) => fetchName(s), 1000);"
                )
            },
            {
                name: "accepts a multi-statement function whose awaits all go through fromPromise",
                code: lines(
                    `import { fromPromise, isErr, ok } from "${PACKAGE}/result";`,
                    "export async function load() {",
                    "    const res = await fromPromise(fetchName(), (cause) => cause);",
                    "    if (isErr(res)) return res;",
                    "    return ok(res.value);",
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
                        message: messageWith(
                            "`load` is async without a `try`/`catch`",
                            `Fix: put the body in \`try { … } catch { return err(); }\` (after a directive such as \`"use cache"\`) with \`import { err } from "${PACKAGE}";\` and \`return ok(value)\` in the \`try\``,
                            "Do not wrap only part of the body"
                        ),
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
                        message: messageWith(
                            "`load` is async without a `try`/`catch`",
                            "Fix: put the body in `try { … } catch { return err(); }`"
                        ),
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
        messageId: "useMaybe",
        guard: "isMaybe"
    },
    {
        name: "prefer-nullable",
        typeName: "Nullable",
        union: "string | null | undefined",
        messageId: "useNullable",
        guard: "isNullable"
    },
    {
        name: "prefer-optional",
        typeName: "Optional",
        union: "string | undefined",
        messageId: "preferOptional",
        guard: "isOptional"
    }
] as const;

describe.each(TYPE_RULES)("$name imports the type it rewrites to", (entry) => {
    const { typeName, union, messageId, guard } = entry;
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
                errors: [
                    {
                        message: messageWith(
                            `\`${union}\` is the type typebuddy names \`${typeName}<string>\``,
                            `\`${guard}\` narrows`,
                            `Fix: \`${typeName}<string>\` with \`import type { ${typeName} } from "${PACKAGE}";\``
                        )
                    }
                ],
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

describe("no-double-type-assertion", () => {
    tester.run(
        "no-double-type-assertion",
        pluginRule("no-double-type-assertion"),
        {
            valid: [
                {
                    name: "allows a single type assertion",
                    code: "export const x = value as string;"
                },
                {
                    name: "allows casting to const",
                    code: "export const x = { a: 1 } as const;"
                }
            ],
            invalid: [
                {
                    name: "flags casting through unknown",
                    code: "export const x = value as unknown as string;",
                    errors: [{ messageId: "noDoubleAssertion" }]
                },
                {
                    name: "flags casting through any",
                    code: "export const x = (value as any) as number;",
                    errors: [{ messageId: "noDoubleAssertion" }]
                }
            ]
        }
    );
});

describe("no-ignored-result", () => {
    tester.run("no-ignored-result", pluginRule("no-ignored-result"), {
        valid: [
            {
                name: "allows assigning an AsyncResult call",
                code: lines(
                    "export async function save(): AsyncResult<void> { return ok(); }",
                    "export async function run() {",
                    "    const res = await save();",
                    "    return res;",
                    "}"
                )
            },
            {
                name: "allows explicitly discarding with void",
                code: lines(
                    "export async function save(): AsyncResult<void> { return ok(); }",
                    "export async function run() {",
                    "    void (await save());",
                    "}"
                )
            },
            {
                name: "allows non-Result function calls as statements",
                code: lines("function log(msg: string): void {}", 'log("hi");')
            },
            {
                name: "ignores a local ok() helper that is not imported from typebuddy",
                code: lines("function ok(value: boolean): void {}", "ok(true);")
            }
        ],
        invalid: [
            {
                name: "flags an ignored local AsyncResult call",
                code: lines(
                    "export async function save(): AsyncResult<void> { return ok(); }",
                    "export async function run() {",
                    "    await save();",
                    "}"
                ),
                errors: [{ messageId: "ignoredResult" }]
            },
            {
                name: "flags an ignored imported fromPromise call (including aliases)",
                code: lines(
                    `import { fromPromise as fp } from "${PACKAGE}/result";`,
                    "export async function run() {",
                    "    await fp(doWork(), () => null);",
                    "}"
                ),
                errors: [{ messageId: "ignoredResult" }]
            },
            {
                name: "flags an ignored local Result arrow function call",
                code: lines(
                    "const parse = (): Result<number> => ok(1);",
                    "parse();"
                ),
                errors: [{ messageId: "ignoredResult" }]
            }
        ]
    });
});
