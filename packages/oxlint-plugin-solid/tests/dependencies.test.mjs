import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createLintHarness } from "./helpers.mjs";

// Each case shows that the output of one runtime dependency reaches the rule:
// a dependency that returned something else (an object instead of a function
// after a major version, other data) turns these red. The other suites only
// check that a rule reports or stays silent, which an import that quietly
// breaks does not always change.
let harness = null;

const view = (jsx) => `export const View = (props) => {
    return ${jsx};
};
`;

// A style object with the one property under test.
const styled = (property) => view(`<div style={{ ${property} }} />`);

const kebabCases = Object.freeze([
    // kebab-case 2
    ['fontFamily: "serif"', "Use font-family instead of fontFamily."],
    [
        'WebkitTransition: "none"',
        "Use -webkit-transition instead of WebkitTransition.",
    ],
    [
        'borderTopLeftRadius: "1px"',
        "Use border-top-left-radius instead of borderTopLeftRadius.",
    ],
]);

describe("runtime dependencies reach the rules", () => {
    beforeAll(async () => {
        harness = await createLintHarness();
    });

    afterAll(async () => {
        await harness.cleanup();
    });

    describe("kebab-case", () => {
        kebabCases.forEach(([property, message]) => {
            test(`names ${property}`, async () => {
                const result = await harness.lint(styled(property));

                expect(result.output).toContain(message);
            });
        });

        test("fixes the key of a camel-cased property", async () => {
            const result = await harness.lint(styled('fontFamily: "serif"'), {
                fix: true,
            });

            expect(result.source).toContain('"font-family": "serif"');
        });
    });

    describe("known-css-properties", () => {
        test("rejects a property that is no CSS", async () => {
            const result = await harness.lint(styled('fooBar: "x"'));

            expect(result.output).toContain(
                "fooBar is not a valid CSS property.",
            );
        });

        test("accepts a kebab-cased property", async () => {
            const result = await harness.lint(styled('"font-size": "10px"'));

            expect(result.output).not.toContain("solid(style-prop)");
        });

        test("accepts a custom property", async () => {
            const result = await harness.lint(styled('"--fooBar": "x"'));

            expect(result.output).not.toContain("solid(style-prop)");
        });

        // Data of 0.37: `position-area` is new since 0.30, `anchor-default`
        // was renamed in the CSS spec and dropped.
        test("knows a property that is new in 0.37", async () => {
            const result = await harness.lint(styled('"position-area": "top"'));

            expect(result.output).not.toContain("solid(style-prop)");
        });

        test("no longer knows a property that was dropped in 0.37", async () => {
            const result = await harness.lint(
                styled('"anchor-default": "--a"'),
            );

            expect(result.output).toContain(
                "anchor-default is not a valid CSS property.",
            );
        });
    });

    describe("style-to-object", () => {
        test("turns a style string into an object", async () => {
            const result = await harness.lint(
                view(`<div style="font-size: 10px; color: red" />`),
                { fix: true },
            );

            expect(result.source).toContain(
                'style={{"font-size":"10px","color":"red"}}',
            );
        });

        test("reports a style string it cannot parse, without a fix", async () => {
            const source = view(`<div style="font-size" />`);
            const result = await harness.lint(source, { fix: true });

            expect(result.output).toContain(
                "Use an object for the style prop instead of a string.",
            );
            expect(result.source).toBe(source);
        });
    });

    describe("is-html", () => {
        test("takes a string with a tag for HTML", async () => {
            const result = await harness.lint(
                view(`<div innerHTML="<b>bold</b>">child</div>`),
            );

            expect(result.output).toContain(
                "The innerHTML attribute should not be used on an element with child elements",
            );
        });

        test("takes a string without a tag for text", async () => {
            const result = await harness.lint(
                view(`<div innerHTML="just text" />`),
            );

            expect(result.output).toContain(
                "The string passed to innerHTML does not appear to be valid HTML.",
            );
        });

        test("allows static HTML without children", async () => {
            const result = await harness.lint(
                view(`<div innerHTML="<b>bold</b>" />`),
            );

            expect(result.output).not.toContain("solid(no-innerhtml)");
        });
    });
});
