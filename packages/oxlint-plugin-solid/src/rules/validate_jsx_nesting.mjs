import { isValidHTMLNesting, restructures } from "../html_nesting.mjs";
import { isDOMElementName, jsxGetProp } from "../utils.mjs";

// Rows, row groups and the table itself keep a hidden input as a child, any
// other `input` is moved in front of the table.
const TABLE_PARENTS = new Set(["table", "tbody", "tfoot", "thead", "tr"]);
// Foreign content: the parser follows other rules inside these.
const FOREIGN_ROOTS = new Set(["math", "svg"]);

// The tag name of a JSX element that is a DOM element (`div`, not `Show`),
// lower-cased, or null.
const getDOMTagName = (node) => {
    const name = node.openingElement.name;
    return name.type === "JSXIdentifier" && isDOMElementName(name.name)
        ? name.name.toLowerCase()
        : null;
};

const isTransparent = (node) =>
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression";

// The element `node` ends up inside of, as far as the markup tells: through
// fragments, expression containers, arrays and the branches of `&&`/`?:`.
// Null when it is somewhere that cannot be followed (a callback, a variable).
const getDOMParent = (node) => {
    let current = node;
    let parent = current.parent;

    while (parent) {
        switch (parent.type) {
            case "JSXElement":
                return parent.children.includes(current) ? parent : null;
            case "JSXAttribute":
                return parent.name.type === "JSXIdentifier" &&
                    parent.name.name === "children" &&
                    parent.parent?.type === "JSXOpeningElement" &&
                    parent.parent.parent?.type === "JSXElement"
                    ? parent.parent.parent
                    : null;
            case "JSXFragment":
            case "JSXExpressionContainer":
            case "ArrayExpression":
                current = parent;
                parent = parent.parent;
                break;
            case "LogicalExpression":
                if (parent.right !== current) {
                    return null;
                }
                current = parent;
                parent = parent.parent;
                break;
            case "ConditionalExpression":
                if (parent.test === current) {
                    return null;
                }
                current = parent;
                parent = parent.parent;
                break;
            default:
                if (!isTransparent(parent)) {
                    return null;
                }
                current = parent;
                parent = parent.parent;
        }
    }

    return null;
};

// Whether `node` reaches `parent` through an expression (`{cond && <p />}`,
// `children={...}`) instead of as a plain child: the client builds that DOM
// as written, only the server-rendered HTML is repaired by the parser.
const isInserted = (node, parent) => {
    let current = node.parent;
    while (current && current !== parent) {
        if (
            current.type === "JSXExpressionContainer" ||
            current.type === "JSXAttribute"
        ) {
            return true;
        }
        current = current.parent;
    }

    return false;
};

// Whether any element around `node` is `<svg>` or `<math>`.
const isInForeignContent = (node) => {
    for (let current = node.parent; current; current = current.parent) {
        if (
            current.type === "JSXElement" &&
            FOREIGN_ROOTS.has(getDOMTagName(current) ?? "")
        ) {
            return true;
        }
    }

    return false;
};

const isHiddenInput = (node) => {
    const type = jsxGetProp(node.openingElement.attributes, "type")?.value;
    return (
        type?.type === "Literal" &&
        typeof type.value === "string" &&
        type.value.toLowerCase() === "hidden"
    );
};

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow HTML nesting the browser refuses to keep, like `<p><div /></p>`, which silently renders a different DOM than the JSX describes.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/validate-jsx-nesting.md",
        },
        messages: {
            invalidNesting:
                "Invalid HTML nesting: `<{{child}}>` cannot be a child of `<{{parent}}>`. The HTML parser restructures this, so the rendered DOM won't match this markup.",
            invalidNestingInserted:
                "Invalid HTML nesting: `<{{child}}>` cannot be a child of `<{{parent}}>`. The client inserts it as written, but the HTML parser restructures it in server-rendered HTML, so hydration won't match this markup.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const check = (node, child, parentNode) => {
            const parent = getDOMTagName(parentNode);
            if (!parent || isInForeignContent(parentNode)) {
                return;
            }
            if (isValidHTMLNesting(parent, child)) {
                return;
            }
            if (!restructures(parent, child)) {
                return;
            }
            if (
                child === "input" &&
                TABLE_PARENTS.has(parent) &&
                isHiddenInput(node)
            ) {
                return;
            }

            context.report({
                node: node.openingElement.name,
                messageId: isInserted(node, parentNode)
                    ? "invalidNestingInserted"
                    : "invalidNesting",
                data: { parent, child },
            });
        };

        return {
            JSXElement(node) {
                const child = getDOMTagName(node);
                if (!child) {
                    return;
                }

                const parentNode = getDOMParent(node);
                if (parentNode) {
                    check(node, child, parentNode);
                }
            },
        };
    },
};
