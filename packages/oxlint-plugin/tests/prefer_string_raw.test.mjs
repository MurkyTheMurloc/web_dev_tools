import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createLintHarness } from "./helpers.mjs";

const RULE = "murky(prefer-string-raw)";
const RULES = { "murky/prefer-string-raw": "error" };

// soferno's renderer/script_json.ts: evaluated at module load, stays plain.
const MODULE_LITERAL_CODE = String.raw`const ESCAPES = new Map([
    ["<", "\\u003c"],
    ["\u2028", "\\u2028"],
    ["\u2029", "\\u2029"]
]);
export const PATH = "C:\\dir\\file";
export class Paths {
    static readonly root = "C:\\root";
    static ["a\\b"] = 1;
    static other = "";
    static {
        Paths.other = "x\\y";
    }
}
export function escape(text: string): string {
    return text.replaceAll("<", ESCAPES.get("<") ?? "");
}
`;

const MODULE_RAW_CODE =
    String.raw`declare const name: string;
export const LT = String.raw` +
    "`\\u003c`" +
    String.raw`;
export const ESCAPES = new Map([["<", String.raw` +
    "`\\u003c`" +
    String.raw`]]);
export class Box {
    static pattern = String.raw` +
    "`a\\.b`" +
    String.raw`;
}
export const glob = String.raw` +
    "`${name}\\dir`" +
    String.raw`;
`;

const FUNCTION_CODE =
    String.raw`export function lt(): string {
    return "\\u003c";
}
export const arrow = (): string => "a\\b";
export class Re {
    field = "x\\y";
    static make = (): string => "p\\q";
    method(): string {
        return String.raw` +
    "`a\\.b`" +
    String.raw`;
    }
}
export function raw(): string {
    return String.raw` +
    "`\\u003c`" +
    String.raw`;
}
export const iife = ((): string => String.raw` +
    "`i\\j`" +
    String.raw`)();
export function keyword(): string {
    return"k\\w";
}
`;

// unicorn's exclusions, inside a function so the module-load exception does
// not hide them. Only the computed key and the typed value are reported.
const EXCLUSIONS_CODE =
    String.raw`interface Keys {
    "a\\b": string;
}
export function View(): unknown {
    "a\\b";
    const keyed = { "a\\b": 1 };
    const computed = { ["c\\d"]: 1 };
    const typed: "e\\f" | string = "e\\f";
    const others = ["a\\b\n", "a\\", "a\\b` +
    "`" +
    String.raw`", "a\\b${"${x}"}"];
    return [keyed, computed, typed, others, <div title="a\\b" />];
}
export type { Keys };
`;

function count(text, fragment) {
    return text.split(fragment).length - 1;
}

let harness = null;

// Oxlint wraps long messages onto `  | ` continuation lines.
function lint(code, options = {}) {
    const result = harness.lint(code, { rules: RULES, ...options });
    return { ...result, output: result.output.replace(/\n\s*\| /gu, " ") };
}

beforeAll(() => {
    harness = createLintHarness();
});

afterAll(() => {
    harness?.cleanup();
});

describe("murky/prefer-string-raw at module load", () => {
    test("plain literals with escaped backslashes pass", () => {
        const { output } = lint(MODULE_LITERAL_CODE);

        expect(output).not.toContain(RULE);
    });

    test("String.raw is reported with the plain literal to write", () => {
        const { output } = lint(MODULE_RAW_CODE);

        expect(count(output, `${RULE}:`)).toBe(4);
        expect(output).toContain(
            'String.raw`\\u003c` runs at module load: a tagged template is a function call, and a bundler cannot prove it pure, so it stays in every client chunk that imports this module even when the value is never used. Fix: `"\\\\u003c"`, the same string as a plain literal with escaped backslashes, which a bundler drops when unused.'
        );
        expect(output).toContain('Fix: `"a\\\\.b"`');
        expect(output).toContain("Fix: ``${name}\\\\dir``");
    });

    test("a local `String` is not the global one", () => {
        const { output } = lint(
            'import { String } from "./strings";\nexport const LT = String.raw`\\u003c`;\n'
        );

        expect(output).not.toContain(RULE);
    });

    test("--fix writes the plain literal", () => {
        const { source } = lint(MODULE_RAW_CODE, { fix: true });

        expect(source).toContain(String.raw`export const LT = "\\u003c";`);
        expect(source).toContain(String.raw`new Map([["<", "\\u003c"]]);`);
        expect(source).toContain(String.raw`static pattern = "a\\.b";`);
        expect(source).toContain("export const glob = `${name}\\\\dir`;");
        expect(source).not.toContain("String.raw");
    });
});

describe("murky/prefer-string-raw inside functions", () => {
    test("escaped backslashes are reported, String.raw passes", () => {
        const { output } = lint(FUNCTION_CODE);

        expect(count(output, `${RULE}:`)).toBe(5);
        expect(output).toContain(
            '`"\\\\u003c"` escapes its backslashes: every `\\\\` in the code is one `\\` in the string, which makes a path, a regex or an escape sequence hard to read and check. Fix: String.raw`\\u003c`. The tag is a call, so this applies inside functions only; at module load the plain literal is allowed.'
        );
        expect(output).toContain('`"x\\\\y"` escapes');
        expect(output).toContain('`"p\\\\q"` escapes');
        expect(output).not.toContain("String.raw`a\\.b` runs");
        expect(output).not.toContain("String.raw`i\\j` runs");
    });

    test("--fix writes String.raw, with a space after a keyword", () => {
        const { source } = lint(FUNCTION_CODE, { fix: true });

        expect(source).toContain("return String.raw`\\u003c`;");
        expect(source).toContain("(): string => String.raw`a\\b`;");
        expect(source).toContain("field = String.raw`x\\y`;");
        expect(source).toContain("return String.raw`k\\w`;");
    });

    test("unicorn's exclusions stay silent", () => {
        const { output } = lint(EXCLUSIONS_CODE);

        expect(count(output, `${RULE}:`)).toBe(2);
        expect(output).toContain('`"c\\\\d"` escapes');
        expect(output).toContain('`"e\\\\f"` escapes');
    });
});
