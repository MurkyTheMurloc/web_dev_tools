import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { typebuddyOxlintPlugin } from "../oxlint/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// `typebuddy/no-useless-undefined` is a fork of unicorn's rule as oxlint ships
// it. The cases below are oxlint's tests for that rule (which port upstream
// unicorn's), plus the typebuddy exception: an `Optional<T>` `let` keeps its
// `undefined` start value.
const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: "ts" } }
});

type TesterRule = Parameters<RuleTester["run"]>[1];
type Valid = Parameters<RuleTester["run"]>[2]["valid"][number];
type Invalid = Parameters<RuleTester["run"]>[2]["invalid"][number];

function isTesterRule(value: unknown): value is TesterRule {
    return (
        typeof value === "object" &&
        value !== null &&
        "create" in value &&
        typeof value.create === "function"
    );
}

const rule = typebuddyOxlintPlugin.rules["no-useless-undefined"];
if (!isTesterRule(rule)) {
    throw new Error("typebuddy/no-useless-undefined is not a rule");
}

function messageWith(...pieces: string[]): RegExp {
    const escaped = pieces.map((piece) =>
        piece.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    );
    return new RegExp(escaped.join("[\\s\\S]*"), "u");
}

const JS = { filename: "file.js" };
const NO_ARGUMENTS = [{ checkArguments: false }];
const NO_ARROW_BODY = [{ checkArrowFunctionBody: false }];

/** A reported case: `output` is the autofixed code, `null` for no autofix. */
function fixed(
    code: string,
    output: string | null,
    errors = 1,
    extra: Partial<Invalid> = {}
): Invalid {
    return { code, output, errors, ...extra };
}

/** A reported `cond ? array[i] : undefined` with its editor suggestion. */
function suggested(code: string, output: string | null): Invalid {
    return {
        code,
        output: null,
        errors: [
            {
                messageId: "guardedIndexedAccess",
                suggestions:
                    output === null
                        ? []
                        : [{ messageId: "useIndexedAccess", output }]
            }
        ]
    };
}

const valid: Valid[] = [
    "function foo() {return;}",
    "const foo = () => {};",
    "let foo;",
    "var foo;",
    "const foo = undefined;",
    "foo();",
    "foo(bar,);",
    "foo(undefined, bar);",
    "const {foo} = {};",
    "function foo({bar} = {}) {}",
    "function foo(bar) {}",
    "function* foo() {yield* undefined;}",
    // Calls whose trailing `undefined` means something.
    "if (Object.is(foo, undefined)){}",
    "t.is(foo, undefined)",
    "assert.equal(foo, undefined, message)",
    "assert.notEqual(foo, undefined, message)",
    "assert.strictEqual(foo, undefined, message)",
    "assert.notStrictEqual(foo, undefined, message)",
    "assert.propertyVal(foo, 'bar', undefined, message)",
    "assert.notPropertyVal(foo, 'bar', undefined, message)",
    "expect(foo).not(undefined)",
    "expect(foo).to.have.property('bar', undefined)",
    "expect(foo).toBe(undefined)",
    "expect(foo).toContain(undefined)",
    "expect(foo).toContainEqual(undefined)",
    "expect(foo).toEqual(undefined)",
    "t.same(foo, undefined)",
    "t.notSame(foo, undefined)",
    "t.strictSame(foo, undefined)",
    "t.strictNotSame(foo, undefined)",
    "expect(someFunction).toHaveBeenCalledWith(1, 2, undefined);",
    "set.add(undefined);",
    "map.set(foo, undefined);",
    "array.push(foo, undefined);",
    "array.push(undefined);",
    "array.unshift(foo, undefined);",
    "array.unshift(undefined);",
    "createContext(undefined);",
    "React.createContext(undefined);",
    "useRef(undefined);",
    "React.useRef(undefined);",
    "setState(undefined)",
    "setState?.(undefined)",
    "props.setState(undefined)",
    "props.setState?.(undefined)",
    "array.includes(undefined)",
    "set.has(undefined)",
    "createContext<T>(undefined);",
    "React.createContext<T>(undefined);",
    "useRef<T>(undefined);",
    "React.useRef<T>(undefined);",
    "prerenderPaths?.add(entry)",
    "foo((undefined));",
    // `Function#bind()` binds the arguments after `this`.
    "foo.bind(bar, undefined);",
    "foo.bind(...bar, undefined);",
    "foo.bind(...[], undefined);",
    "foo.bind(...[undefined], undefined);",
    "foo.bind(bar, baz, undefined);",
    "foo?.bind(bar, undefined);",
    "call(undefined, ...values);",
    "call.bind(receiver, undefined);",
    { code: "foo(undefined, undefined);", options: NO_ARGUMENTS },
    { code: "foo.bind(undefined);", options: NO_ARGUMENTS },
    { code: "foo(value, undefined);", options: NO_ARGUMENTS, ...JS },
    {
        code: "function run(name?: string) { return name; } run(undefined);",
        options: NO_ARGUMENTS
    },
    { code: "const foo = () => undefined", options: NO_ARROW_BODY },
    "const x = { a: undefined }",
    "const y: any = {}; y.foo = undefined",
    "class Foo { public x: number | undefined = undefined }",
    // An annotated return type keeps the `undefined`, unless it is `void` or
    // `undefined`.
    "function getThing(): string | undefined { if (someCondition) { return 'a'; } return undefined; }",
    "function f(): number | undefined { return undefined; }",
    "function f(): Optional<number> { return undefined; }",
    "const foo = (): number => {return undefined;}",
    "const foo = (): undefined => undefined;",
    "const foo = (): string => undefined;",
    "const foo = function (): number {return undefined}",
    "export function foo(): number {return undefined}",
    "const object = { method(): number { return undefined; } }",
    "class A { method(): number { return undefined; } }",
    "class A { static get method(): number { return undefined; } }",
    "class A { #method(): number { return undefined; } }",
    "function f(): number { const g = (): undefined => undefined; return 1; }",
    // A preceding optional parameter keeps the default.
    "function foo(optional?: string, required: string = undefined) {}",
    "function getBackLinks(subject: string, limit = 16, cursor?: string, reverse = false, ttl: number | undefined = undefined) {}",
    // `var` and `using` initializers.
    "function f(): void { using x = undefined; }",
    "var x = undefined;",
    "var x: number | undefined = undefined;",
    "for (const item of items) { var value = undefined; value ??= item; }",
    // Destructuring needs its initializer.
    "function f(): void { let {x} = undefined; }",
    "function f(): void { let [x] = undefined; }",
    "function f(): void { return(undefined)\n[1].forEach(fn); }",
    // A local `undefined` is not the global one.
    "function a() { const undefined = 1; let x = undefined; return x; }",
    "function c(undefined) { return undefined; }",
    "function d(undefined, f) { return f(undefined, undefined); }",
    "function* e(undefined) { yield undefined; }",
    "function g(undefined, h = undefined) { return h; }",
    "const arrow = (undefined) => undefined;",
    "function defaults(undefined) { const {x = undefined} = {}; }",
    "function f(undefined: any): number { const g = () => undefined; return g(); }",
    // Destructuring assignment, not a binding.
    "[a = undefined] = b;",
    "({a = undefined} = b);",
    // Guarded indexed access that is not a pure bounds check.
    "const value = index >= 0 ? array[index] : other;",
    "const value = index >= 0 ? array[index] : (undefined as Foo);",
    "const value = index >= 0 ? object.property : undefined;",
    "const value = index >= 0 ? array?.[index] : undefined;",
    "const value = index >= 0 ? object?.items[index] : undefined;",
    "const value = index >= 0 ? getArray()[index] : undefined;",
    "const value = index >= 0 ? [() => foo?.bar][index] : undefined;",
    "const value = index >= 0 ? object.items[index] : undefined;",
    "const value = index >= 0 ? array[index++] : undefined;",
    "const value = index >= 0 ? array[getIndex()] : undefined;",
    "const value = index < otherArray.length ? array[index] : undefined;",
    "const value = index >= 0 ? array[index + 1] : undefined;",
    "const value = index >= 5 ? array[index] : undefined;",
    "const value = index < array.length ? array[index - 1] : undefined;",
    "const value = condition ? array[index] : undefined;",
    "const value = index == 0 ? array[index] : undefined;",
    "const value = index >= 0.5 ? array[index - 0.5] : undefined;",
    "const value = index < array?.length ? array[index] : undefined;",
    "const value = index <= array.length ? array[index] : undefined;",
    "const value = index < 0 ? array[index] : undefined;",
    // typebuddy: `undefined` is the start value of an `Optional<T>`.
    "let value: Optional<string> = undefined;",
    "let value: string | undefined = undefined;",
    "let value: undefined | Optional<number> | null = undefined;",
    "let first: Optional<number> = undefined, second: number | undefined = undefined;",
    "function f(): void { let x: 0 | undefined = ((undefined)); }"
];

const invalid: Invalid[] = [
    // `return` and `yield`.
    fixed("function foo() {return undefined;}", "function foo() {return;}"),
    fixed(
        "const foo = () => {return undefined;};",
        "const foo = () => {return;};"
    ),
    fixed(
        "function foo() {return       undefined;}",
        "function foo() {return;}"
    ),
    fixed(
        "function foo() {return /* comment */ undefined;}",
        "function foo() {return /* comment */;}"
    ),
    fixed(
        "function f(): void { return (undefined); }",
        "function f(): void { return; }"
    ),
    fixed(
        "function f(): undefined { return ((undefined)); }",
        "function f(): undefined { return; }"
    ),
    fixed(
        "function f(): void { return (undefined) /* keep */; }",
        "function f(): void { return /* keep */; }"
    ),
    fixed("function f(): void { return (/* keep */ undefined); }", null),
    fixed(
        "const f = (): void => { return undefined; };",
        "const f = (): void => { return; };"
    ),
    fixed(
        "function f(): number { const g = () => { return undefined; }; return 1; }",
        "function f(): number { const g = () => { return; }; return 1; }"
    ),
    fixed(
        "function foo(): undefined { function nested() { return undefined; } return nested(); }",
        "function foo(): undefined { function nested() { return; } return nested(); }"
    ),
    fixed(
        "class A { get x() { return undefined; } }",
        "class A { get x() { return; } }"
    ),
    fixed("function* foo() {yield undefined;}", "function* foo() {yield;}"),
    fixed(
        "function* foo() {yield                 undefined;}",
        "function* foo() {yield;}"
    ),
    fixed("function* f(): Generator { yield (/* keep */ undefined); }", null),
    // Concise arrow bodies.
    fixed("const foo = () => undefined;", "const foo = () => {};"),
    fixed("const foo = () => undefined;", "const foo = () => {};", 1, {
        options: [{ checkArrowFunctionBody: true }]
    }),
    fixed("const f = () => (/* keep */ undefined);", null),
    // Trailing arguments: reported, never autofixed.
    fixed("foo(undefined);", null),
    fixed("foo(undefined, undefined);", null),
    fixed("foo(bar, undefined, undefined);", null),
    fixed("foo(undefined, bar, undefined);", null),
    fixed(
        "foo(undefined, bar, undefined, undefined, undefined, undefined,);",
        null
    ),
    fixed("foo(...values, undefined);", null, 1, JS),
    fixed("call?.(value, undefined, undefined);", null),
    fixed("foo.bind(undefined)", null),
    fixed("bind(foo, undefined)", null),
    fixed("foo.bind?.(bar, undefined)", null),
    fixed("foo[bind](bar, undefined)", null),
    fixed("foo.notBind(bar, undefined)", null),
    fixed("foo(undefined);", null, 1, { options: [{ checkArguments: true }] }),
    fixed("function run(name) { return name; } run(undefined);", null, 1, JS),
    // Destructuring defaults: autofixed in JavaScript only, where removing
    // them cannot change an inferred type.
    fixed("const {foo = undefined} = {};", null),
    fixed("const [foo = undefined] = [];", null),
    fixed("function foo([bar = undefined] = []) {}", null),
    fixed("function foo({bar = undefined}) {}", null),
    fixed(
        "function f(): number { const {x = undefined} = {}; return 1; }",
        null
    ),
    fixed("const {x = undefined} = {};", "const {x} = {};", 1, JS),
    fixed("const {x = ((undefined))} = {};", "const {x} = {};", 1, JS),
    fixed("const {x = (/* keep */ undefined)} = {};", null, 1, JS),
    fixed("function f([x = undefined]) {}", "function f([x]) {}", 1, JS),
    // Parameter defaults.
    fixed("function f(p = undefined) {}", "function f(p) {}", 1, JS),
    fixed("function f(x = ((undefined))) {}", "function f(x) {}", 1, JS),
    fixed("function foo(bar = undefined) {}", null),
    fixed("function f(p = undefined): number { return 1; } f();", null),
    fixed(
        "function foo(x: string | undefined = undefined) { }",
        "function foo(x?: string | undefined) { }"
    ),
    fixed(
        "function f(p: number | undefined = undefined, q: number): number { return q; }",
        "function f(p: number | undefined, q: number): number { return q; }"
    ),
    fixed(
        "function f(p: undefined = undefined): number { return 1; }",
        "function f(p?: undefined): number { return 1; }"
    ),
    fixed(
        "const f = (p: undefined = undefined): number => 1;",
        "const f = (p?: undefined): number => 1;"
    ),
    fixed(
        "function f(x: undefined = ((undefined))): void {}",
        "function f(x?: undefined): void {}"
    ),
    fixed("function f(x: undefined = (/* keep */ undefined)): void {}", null),
    fixed(
        "class C { constructor(readonly x: number | undefined = undefined) {} }",
        null
    ),
    // `let` without an `Optional<T>` type: reported, no autofix, because the
    // fix is a type or a real default, not `let x;`.
    fixed("let a = undefined;", null),
    // Unlike the typebuddy conventions, this rule lints test files, as
    // unicorn's did.
    fixed("let a = undefined;", null, 1, { filename: "src/a.test.ts" }),
    fixed("let a = undefined, b = 2;", null),
    fixed("let value = undefined; foo(value, undefined);", null, 2),
    fixed("let a: string = undefined;", null),
    fixed("let a: Maybe<string> = undefined;", null),
    fixed("function f(): number { let x = undefined; return 1; }", null),
    // Guarded indexed access: an editor suggestion, never an autofix.
    suggested(
        "const value = index >= 0 ? array[index] : undefined;",
        "const value = array[index];"
    ),
    suggested(
        "const value = index > -1 ? array[index] : undefined;",
        "const value = array[index];"
    ),
    suggested(
        "const value = index < 0 ? undefined : array[index];",
        "const value = array[index];"
    ),
    suggested(
        "const value = array.length > index ? array[index] : undefined;",
        "const value = array[index];"
    ),
    suggested(
        "const value = index <= array.length - 1 ? array[index] : undefined;",
        "const value = array[index];"
    ),
    suggested(
        "const value = index >= array.length ? undefined : array[index];",
        "const value = array[index];"
    ),
    suggested(
        "const value = index >= 5 ? array[index - 5] : undefined;",
        "const value = array[index - 5];"
    ),
    suggested(
        "const value = 0n < array.length ? array[0n] : undefined;",
        "const value = array[0n];"
    ),
    suggested(
        "const value = index >= 0 ? (array[index] as string) : undefined;",
        "const value = (array[index] as string);"
    ),
    suggested(
        "const value = <number>index >= 0 ? array[<number>index] : undefined;",
        "const value = array[<number>index];"
    ),
    suggested(
        "function f() { return(index) >= 0 ? array[index] : undefined; }",
        "function f() { return array[index]; }"
    ),
    suggested(
        "a()\nindex >= 0 ? [array][index] : undefined;",
        "a()\n;[array][index];"
    ),
    suggested(
        "if (condition) index >= 0 ? [array][index] : undefined;",
        "if (condition) [array][index];"
    ),
    suggested("index >= 0 ? {}[index] : undefined;", "({}[index]);"),
    suggested(
        "const value = index >= 0 ? array[index] /* keep */ : undefined;",
        null
    ),
    suggested("(index >= 0 ? array[index] : undefined)();", null),
    suggested("delete (index >= 0 ? array[index] : undefined);", null)
];

describe("no-useless-undefined", () => {
    tester.run("no-useless-undefined", rule, { valid, invalid });

    tester.run("no-useless-undefined messages", rule, {
        valid: [],
        invalid: [
            {
                name: "tells an un-annotated let to take an Optional type or a real default",
                code: "let count = undefined;",
                output: null,
                errors: [
                    {
                        message: messageWith(
                            "`let count = undefined` starts `count` at `undefined`",
                            "Fix: annotate it, `let count: Optional<T> = undefined;`",
                            "`undefined` is the start value of an `Optional<T>`",
                            "a `Maybe<T>` starts at `null`: `let count: Maybe<T> = null;`",
                            "or give `count` its real default.",
                            "Do not: drop the initializer (`let count;`), `eslint/init-declarations`"
                        )
                    }
                ]
            },
            {
                name: "names the optional parameter in the fix",
                code: "function load(id: string = undefined) {}",
                output: "function load(id?: string) {}",
                errors: [{ message: messageWith("Fix: `id?: string`.") }]
            }
        ]
    });
});
