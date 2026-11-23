// eslint's max-lines-per-function (skipBlankLines, skipComments, IIFEs) with a
// message per kind of function. oxlint can neither change a built-in rule's
// message nor wrap it from a JS plugin, so the counting is redone here. A Solid
// component runs once, so extracting from it costs nothing; the messages name
// what to extract and where, and the two ways extraction breaks reactivity
// (destructured props, a primitive that gets a value instead of an accessor).
import { getFunctionHeadLocation } from "@eslint-community/eslint-utils";

import { getSourceCode } from "../compat.mjs";
import { getFunctionName } from "../utils.mjs";

const DEFAULT_MAX = 60;
const DEFAULT_MAX_COMPONENT = 80;
const COMPONENT_NAME = /^[A-Z]/u;
const PRIMITIVE_NAME = /^(?:create|use)[A-Z0-9]/u;
const JSX_FILE = /\.[jt]sx$/u;
const DO_NOT_SPLIT =
    "If splitting would scatter one cohesive unit, leave it and add a one-line comment above `{{name}}` saying why.";

// Code lines of the file as a prefix sum: `counts[line]` is the number of
// lines up to and including `line` that keep text once comments are blanked.
function countCodeLines(sourceCode) {
    const text = sourceCode.text.split("");
    const comments = sourceCode.getAllComments?.() ?? sourceCode.ast.comments;
    for (const comment of comments) {
        const [start, end] = comment.range ?? [comment.start, comment.end];
        for (let index = start; index < end; index += 1) {
            if (text[index] !== "\n") {
                text[index] = " ";
            }
        }
    }
    const counts = [0];
    for (const line of text.join("").split("\n")) {
        counts.push(counts.at(-1) + (line.trim() === "" ? 0 : 1));
    }

    return counts;
}

function nameOf(node, sourceCode) {
    const name = getFunctionName(node);
    if (name !== null) {
        return name;
    }
    const { parent } = node;
    if (
        (parent.type === "Property" ||
            parent.type === "MethodDefinition" ||
            parent.type === "PropertyDefinition") &&
        !parent.computed
    ) {
        return parent.key.name ?? String(parent.key.value);
    }
    if (parent.type === "AssignmentExpression") {
        return sourceCode.getText(parent.left);
    }
    if (parent.type === "CallExpression" && parent.callee !== node) {
        return `${sourceCode.getText(parent.callee)} callback`;
    }
    if (parent.type === "ExportDefaultDeclaration") {
        return "default export";
    }

    return "anonymous function";
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Limit the code lines of a function, with a stricter message for components and `createX` primitives.",
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-solid#solidfunction-size"
        },
        schema: [
            {
                type: "object",
                properties: {
                    max: {
                        type: "integer",
                        minimum: 1,
                        description:
                            "Code lines for a function or primitive (blank and comment lines don't count)."
                    },
                    maxComponent: {
                        type: "integer",
                        minimum: 1,
                        description:
                            "Code lines for a component: a PascalCase function with JSX in a `.tsx`/`.jsx` file."
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            function: `\`{{name}}\` has {{lines}} code lines (max {{max}}; blank and comment lines don't count), so several jobs share one body and none can be tested or reused alone. Fix: move each self-contained step (lines {{start}}–{{end}} first) into a named pure helper that takes its inputs as parameters and returns a value; put a helper used by more than one file in its own snake_case \`.ts\`. ${DO_NOT_SPLIT} Do not: delete comments, join lines, split into \`{{name}}Part1\`/\`Part2\` that just run in sequence, or add \`// oxlint-disable\`.`,
            component: `Component \`{{name}}\` has {{lines}} code lines (max {{max}}), so several pieces of UI and their state can't be reused or tested separately. Fix: move repeated or self-contained JSX into a sub-component in its own PascalCase \`.tsx\` that receives values (\`<Slot label={label()} />\`, read as \`props.label\`); move signals, memos and effects that belong together into a \`createX\` primitive in a snake_case \`.ts\` that takes accessors (\`createX(() => props.id)\`) and returns accessors. ${DO_NOT_SPLIT} Do not: destructure props, pass \`props.x\` or \`count()\` into a helper or primitive (it is read once), delete comments, join lines, or add \`// oxlint-disable\`.`,
            primitive: `Primitive \`{{name}}\` has {{lines}} code lines (max {{max}}; blank and comment lines don't count), so several concerns share one owner and none can be reused or tested alone. Fix: split it by concern into smaller \`createX\` primitives (lines {{start}}–{{end}} first) in snake_case \`.ts\` files that take accessors (\`createX(() => props.id)\`) and return accessors, and let \`{{name}}\` compose them. ${DO_NOT_SPLIT} Do not: pass \`props.x\` or \`count()\` into a primitive (it is read once), return plain values instead of accessors, delete comments, join lines, or add \`// oxlint-disable\`.`
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = getSourceCode(context);
        const max = context.options[0]?.max ?? DEFAULT_MAX;
        const maxComponent =
            context.options[0]?.maxComponent ?? DEFAULT_MAX_COMPONENT;
        const jsxFile = JSX_FILE.test(
            context.filename ?? context.getFilename()
        );
        const smallest = Math.min(max, jsxFile ? maxComponent : max);
        // One frame per open function; JSX marks every enclosing frame.
        const stack = [];
        let counts = null;
        const codeLines = (node) => {
            counts ??= countCodeLines(sourceCode);

            return counts[node.loc.end.line] - counts[node.loc.start.line - 1];
        };

        // The longest top-level statement is where an agent starts extracting.
        const longestStatement = (node) => {
            const statements =
                node.body.type === "BlockStatement" && node.body.body.length > 0
                    ? node.body.body
                    : [node.body];

            return statements.reduce((longest, statement) => {
                return codeLines(statement) > codeLines(longest)
                    ? statement
                    : longest;
            });
        };

        const exit = (node) => {
            const { hasJsx } = stack.pop();
            if (
                node.body === null ||
                node.loc.end.line - node.loc.start.line + 1 <= smallest
            ) {
                return;
            }
            const name = nameOf(node, sourceCode);
            const component = jsxFile && hasJsx && COMPONENT_NAME.test(name);
            const limit = component ? maxComponent : max;
            const lines = codeLines(node);
            if (lines <= limit) {
                return;
            }
            const start = longestStatement(node);
            let messageId = "function";
            if (component) {
                messageId = "component";
            } else if (PRIMITIVE_NAME.test(name)) {
                messageId = "primitive";
            }
            context.report({
                data: {
                    end: start.loc.end.line,
                    lines,
                    max: limit,
                    name,
                    start: start.loc.start.line
                },
                loc: getFunctionHeadLocation(node, sourceCode),
                messageId
            });
        };
        const enter = () => {
            stack.push({ hasJsx: false });
        };
        const markJsx = () => {
            for (const frame of stack) {
                frame.hasJsx = true;
            }
        };

        return {
            ArrowFunctionExpression: enter,
            "ArrowFunctionExpression:exit": exit,
            FunctionDeclaration: enter,
            "FunctionDeclaration:exit": exit,
            FunctionExpression: enter,
            "FunctionExpression:exit": exit,
            JSXElement: markJsx,
            JSXFragment: markJsx
        };
    }
};
