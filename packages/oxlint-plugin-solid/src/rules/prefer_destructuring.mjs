// Fork of eslint's prefer-destructuring for Solid code. Destructuring is
// preferred everywhere except on reactive sources: `const { x } = props` or
// `const { items } = store` copies the value once at setup and drops
// reactivity, so there `props.x` read where it is used is the right form, and
// eslint's rule pushed toward the bug. Defaults as in eslint (declarations and
// assignments, arrays and objects, no renamed properties); like
// typescript-eslint, a declaration with a type annotation is left alone.
import { findVariable, getSourceCode } from "../compat.mjs";
import {
    getFunctionName,
    isFunctionNode,
    isPropsByName,
    trackImports
} from "../utils.mjs";

/** Calls whose result is a reactive proxy read by property access. */
const REACTIVE_OBJECT_SOURCES = [
    "createStore",
    "createProjection",
    "createOptimisticStore",
    "merge",
    "omit"
];

function isIndexAccess(member) {
    return (
        member.computed &&
        member.property.type === "Literal" &&
        Number.isInteger(member.property.value)
    );
}

function isComponentProps(definition) {
    if (definition.type !== "Parameter") {
        return false;
    }
    const fn = definition.node;
    return (
        isFunctionNode(fn) &&
        fn.params[0] === definition.name &&
        /^[A-Z]/u.test(getFunctionName(fn) ?? "")
    );
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer destructuring, except from props and stores, where it drops reactivity."
        },
        schema: [],
        messages: {
            preferDestructuring:
                "`{{statement}}` reads `{{member}}` into a variable by hand; {{type}} destructuring states the source once. Fix: `{{fix}}`."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();

        function isReactiveSource(object) {
            if (object.type !== "Identifier") {
                return false;
            }
            if (isPropsByName(object.name)) {
                return true;
            }
            const definition = findVariable(context, object)?.defs[0];
            if (!definition) {
                return false;
            }
            if (isComponentProps(definition)) {
                return true;
            }
            const init =
                definition.type === "Variable" ? definition.node.init : null;
            if (
                init?.type !== "CallExpression" ||
                init.callee.type !== "Identifier" ||
                !matchImport(REACTIVE_OBJECT_SOURCES, init.callee.name)
            ) {
                return false;
            }
            // `const [store] = createStore(...)` or `const local = merge(...)`.
            const { id } = definition.node;
            return id.type === "ArrayPattern"
                ? id.elements[0] === definition.name
                : id === definition.name;
        }

        const sourceCode = getSourceCode(context);

        /**
         * The destructuring form of `reportNode`: `const { x } = obj` or `const
         * [, x] = list`, and `({ x } = obj)` for an assignment.
         */
        function buildData(value, reportNode, pattern) {
            const object = sourceCode.getText(value.object);
            const statement =
                reportNode.type === "VariableDeclarator"
                    ? `${reportNode.parent.kind} ${sourceCode.getText(reportNode)}`
                    : sourceCode.getText(reportNode);
            const fix =
                reportNode.type === "VariableDeclarator"
                    ? `${reportNode.parent.kind} ${pattern} = ${object}`
                    : `(${pattern} = ${object})`;
            return {
                fix,
                member: sourceCode.getText(value),
                statement,
                type: pattern.startsWith("[") ? "array" : "object"
            };
        }

        function check(target, value, reportNode) {
            if (
                target.type !== "Identifier" ||
                value?.type !== "MemberExpression"
            ) {
                return;
            }
            if (isIndexAccess(value)) {
                context.report({
                    data: buildData(
                        value,
                        reportNode,
                        `[${", ".repeat(value.property.value)}${target.name}]`
                    ),
                    messageId: "preferDestructuring",
                    node: reportNode
                });
                return;
            }
            if (
                !value.computed &&
                value.property.type === "Identifier" &&
                value.property.name === target.name &&
                !isReactiveSource(value.object)
            ) {
                context.report({
                    data: buildData(value, reportNode, `{ ${target.name} }`),
                    messageId: "preferDestructuring",
                    node: reportNode
                });
            }
        }

        return {
            ImportDeclaration: handleImportDeclaration,
            VariableDeclarator(node) {
                if (node.id.typeAnnotation) {
                    return;
                }
                check(node.id, node.init, node);
            },
            AssignmentExpression(node) {
                if (node.operator === "=") {
                    check(node.left, node.right, node);
                }
            }
        };
    }
};
