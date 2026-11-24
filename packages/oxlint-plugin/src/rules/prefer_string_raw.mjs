// Fork of unicorn's prefer-string-raw as oxlint implements it
// (crates/oxc_linter/src/rules/unicorn/prefer_string_raw.rs): a string literal
// that only escapes backslashes, `"a\\b"`, is written `String.raw` instead.
//
// New: only where the code runs later. `String.raw` is a tagged template, a
// function call; at module load a bundler cannot prove it pure and keeps it in
// every chunk that imports the module, even when the value is unused. So
// - a plain literal evaluated at module load is allowed, and
// - `String.raw` evaluated at module load is reported, fixed to the plain
//   literal: String.raw`\u003c` -> "\\u003c".
// Module load: see `runsAtModuleLoad` in ../utils.mjs.
import {
    isGlobalReference,
    runsAtModuleLoad,
    sourceCodeOf
} from "../utils.mjs";

const BACKSLASH = "\\";
// A string literal under these parents is syntax (a module specifier, an
// attribute, a type, an enum member): a template is not allowed there.
const LITERAL_ONLY_PARENTS = new Set([
    "ExportAllDeclaration",
    "ExportNamedDeclaration",
    "ExportSpecifier",
    "ImportAttribute",
    "ImportDeclaration",
    "ImportSpecifier",
    "JSXAttribute",
    "TSEnumMember",
    "TSExternalModuleReference",
    "TSLiteralType",
    "TSModuleDeclaration"
]);

const DO_NOT = "Do not add `// oxlint-disable`.";

/** `a\\b` in a `"`-quoted literal -> `a\b`; `\"` -> `"`. */
function unescapeBackslash(text, quote) {
    let result = "";
    for (let index = 0; index < text.length; index += 1) {
        const next = text[index + 1];
        if (
            text[index] === BACKSLASH &&
            (next === BACKSLASH || next === quote)
        ) {
            result += next;
            index += 1;
        } else {
            result += text[index];
        }
    }
    return result;
}

function hasOddTrailingBackslashes(value) {
    const count = value.length - value.replace(/\\+$/u, "").length;
    return count % 2 === 1;
}

function isLiteralRequired(node) {
    const { parent } = node;
    return (
        LITERAL_ONLY_PARENTS.has(parent.type) ||
        (parent.type === "ExpressionStatement" && Boolean(parent.directive)) ||
        (parent.key === node &&
            (!parent.computed || parent.type.startsWith("TS")))
    );
}

function isStringRawTag(tag) {
    return (
        tag.type === "MemberExpression" &&
        !tag.computed &&
        !tag.optional &&
        tag.object.type === "Identifier" &&
        tag.object.name === "String" &&
        tag.property.type === "Identifier" &&
        tag.property.name === "raw"
    );
}

/**
 * The same string without the tag: a double-quoted literal, or a template
 * literal with every `\`, backtick and `${` escaped when it has expressions.
 */
function untagged(quasi, sourceCode) {
    if (quasi.expressions.length === 0) {
        return JSON.stringify(quasi.quasis[0].value.raw);
    }
    const parts = quasi.quasis.map(({ value }, index) => {
        const text = value.raw.replace(/\\|`|\$\{/gu, (match) => `\\${match}`);
        const expression = quasi.expressions[index];
        return expression
            ? `${text}\${${sourceCode.getText(expression)}}`
            : text;
    });
    return `\`${parts.join("")}\``;
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer `String.raw` over escaped backslashes inside functions; at module load, prefer the plain literal, which a bundler can drop."
        },
        fixable: "code",
        schema: [],
        messages: {
            preferRaw: `\`{{raw}}\` escapes its backslashes: every \`\\\\\` in the code is one \`\\\` in the string, which makes a path, a regex or an escape sequence hard to read and check. Fix: {{fix}}. The tag is a call, so this applies inside functions only; at module load the plain literal is allowed. ${DO_NOT}`,
            noModuleRaw: `{{raw}} runs at module load: a tagged template is a function call, and a bundler cannot prove it pure, so it stays in every client chunk that imports this module even when the value is never used. Fix: \`{{fix}}\`, the same string as a plain literal with escaped backslashes, which a bundler drops when unused. ${DO_NOT}`
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        if (/\.d\.[cm]?ts$/u.test(context.filename ?? "")) {
            return {};
        }

        return {
            Literal(node) {
                if (
                    typeof node.value !== "string" ||
                    isLiteralRequired(node) ||
                    runsAtModuleLoad(node)
                ) {
                    return;
                }
                const raw = sourceCode.getText(node);
                const { value } = node;
                if (
                    !raw.includes(BACKSLASH + BACKSLASH) ||
                    hasOddTrailingBackslashes(value) ||
                    value.includes("`") ||
                    value.includes("${")
                ) {
                    return;
                }
                const unescaped = unescapeBackslash(raw.slice(1, -1), raw[0]);
                // Another escape (`\n`, `A`, a line continuation) means
                // String.raw would produce a different string.
                if (unescaped !== value) {
                    return;
                }
                // `return"a\\b"` needs a space before the tag.
                const before = sourceCode.text[node.range[0] - 1] ?? "";
                const space = /[\p{ID_Continue}$]/u.test(before) ? " " : "";
                const replacement = `String.raw\`${unescaped}\``;
                context.report({
                    data: { fix: replacement, raw },
                    fix: (fixer) =>
                        fixer.replaceText(node, `${space}${replacement}`),
                    messageId: "preferRaw",
                    node
                });
            },
            TaggedTemplateExpression(node) {
                if (
                    !isStringRawTag(node.tag) ||
                    !runsAtModuleLoad(node) ||
                    !isGlobalReference(sourceCode, node.tag.object)
                ) {
                    return;
                }
                const replacement = untagged(node.quasi, sourceCode);
                context.report({
                    data: { fix: replacement, raw: sourceCode.getText(node) },
                    fix: (fixer) => fixer.replaceText(node, replacement),
                    messageId: "noModuleRaw",
                    node
                });
            }
        };
    }
};
