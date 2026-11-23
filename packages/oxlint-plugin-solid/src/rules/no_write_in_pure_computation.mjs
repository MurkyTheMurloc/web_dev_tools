// Ported from eslint-plugin-solid 0.20.1 (no-write-in-pure-computation).
// `createMemo` callbacks, the compute half of `createEffect(compute, effect)`
// and component bodies are pure owned scopes in Solid 2.0: writing reactive
// state from inside them creates update cycles and throws in dev
// (REACTIVE_WRITE_IN_OWNED_SCOPE). Only setter calls whose nearest enclosing
// function IS the pure scope are reported; a setter in a nested function (an
// event handler, an `onSettled` callback, the effect half) runs later, in an
// imperative scope.
//
// Not the same as no-setter-in-effect, which reports effects that only write
// and should be derivations; both stay.
import { findVariable } from "../compat.mjs";
import {
    findParent,
    getFunctionName,
    isFunctionNode,
    trackImports
} from "../utils.mjs";

const SETTER_PRIMITIVES = ["createSignal", "createStore", "createOptimistic"];

function isOwnedWriteKey(key) {
    return key.type === "Identifier"
        ? key.name === "ownedWrite"
        : key.type === "Literal" && key.value === "ownedWrite";
}

/**
 * Core skips its dev guard for signals created with `ownedWrite: true`. This
 * only says "no" when it can prove the opt-in is absent: no options argument,
 * or an object literal (through one level of const) that is fully readable and
 * lacks `ownedWrite`. Anything else counts as opted in, so the rule can only
 * under-report, never contradict core.
 */
function allowsOwnedWrite(context, init) {
    let options = init.arguments[1];
    if (!options) {
        return false;
    }
    if (options.type === "Identifier") {
        const variable = findVariable(context, options);
        const definition = variable?.defs[0];
        if (
            variable?.defs.length !== 1 ||
            definition?.type !== "Variable" ||
            definition.node.parent?.kind !== "const" ||
            !definition.node.init ||
            // A const object can still be given properties later, or escape;
            // only references that are the options argument stay conclusive.
            variable.references.some((reference) => {
                return (
                    reference.identifier !== definition.node.id &&
                    !(
                        reference.identifier.parent?.type ===
                            "CallExpression" &&
                        reference.identifier.parent.arguments[1] ===
                            reference.identifier
                    )
                );
            })
        ) {
            return true;
        }
        options = definition.node.init;
    }
    if (options.type !== "ObjectExpression") {
        return true;
    }
    return options.properties.some((property) => {
        return (
            property.type === "SpreadElement" ||
            (isOwnedWriteKey(property.key) &&
                !(
                    property.value.type === "Literal" &&
                    property.value.value === false
                ))
        );
    });
}

/**
 * Component-shaped, as in no-destructure and components-return-once: not
 * lowercase-named, not a render prop, and not a plain call argument unless the
 * callee is PascalCase (a HOC).
 */
function isComponent(node) {
    const parent = node.parent;
    return (
        !getFunctionName(node)?.match(/^[a-z]/u) &&
        parent?.type !== "JSXExpressionContainer" &&
        !(
            parent?.type === "CallExpression" &&
            parent.arguments.includes(node) &&
            !parent.callee.name?.match(/^[A-Z]/u)
        )
    );
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow writing signals or stores inside `createMemo`, the compute half of `createEffect`, or a component body, which are pure owned scopes.",
            url: "https://github.com/solidjs/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-write-in-pure-computation.md"
        },
        schema: [],
        messages: {
            writeInMemo:
                "Calling the setter '{{name}}' inside {{api}} makes the computation impure and creates an update cycle. Derive the value instead of storing it, or move the write to an effect.",
            writeInCompute:
                "Calling the setter '{{name}}' in the compute half of {{api}} — the compute function is tracked and must be pure. Move the write into the effect half (the second argument).",
            writeInComponent:
                "Calling the setter '{{name}}' during component setup — the body runs once as a pure owned scope, and Solid 2.0 throws on setup writes in dev. Initialize the state with the right value instead, or move the write into an effect half or event handler."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();

        /**
         * Pure computation callbacks, mapped to how a write in them is
         * reported.
         */
        const computations = new Map();
        /**
         * Setter calls in a function that may be a component; decided at its
         * exit.
         */
        const pendingComponentWrites = new Map();
        const functionStack = [];

        function isSetter(identifier) {
            const definition = findVariable(context, identifier)?.defs[0];
            if (definition?.type !== "Variable" || !definition.node.init) {
                return false;
            }
            const { id, init } = definition.node;
            if (
                id.type !== "ArrayPattern" ||
                id.elements[1]?.type !== "Identifier" ||
                id.elements[1].name !== identifier.name ||
                init.type !== "CallExpression" ||
                init.callee.type !== "Identifier"
            ) {
                return false;
            }
            const primitive = matchImport(SETTER_PRIMITIVES, init.callee.name);
            if (!primitive) {
                return false;
            }
            // `ownedWrite` is a signal option; store setters have no such exemption.
            return (
                primitive === "createStore" || !allowsOwnedWrite(context, init)
            );
        }

        function enterFunction() {
            functionStack.push({ hasJSX: false });
        }

        function markJSX() {
            const current = functionStack.at(-1);
            if (current) {
                current.hasJSX = true;
            }
        }

        function exitFunction(node) {
            const { hasJSX } = functionStack.pop() ?? { hasJSX: false };
            const pending = pendingComponentWrites.get(node);
            if (!pending) {
                return;
            }
            pendingComponentWrites.delete(node);
            if (!hasJSX || computations.has(node) || !isComponent(node)) {
                return;
            }
            for (const call of pending) {
                context.report({
                    data: { name: call.callee.name },
                    messageId: "writeInComponent",
                    node: call
                });
            }
        }

        function registerComputation(node) {
            const memoName = matchImport(
                ["createMemo", "createDeferred"],
                node.callee.name
            );
            if (memoName) {
                if (isFunctionNode(node.arguments[0])) {
                    computations.set(node.arguments[0], {
                        api: memoName,
                        messageId: "writeInMemo"
                    });
                }
                return true;
            }
            const effectName = matchImport(
                ["createEffect", "createRenderEffect"],
                node.callee.name
            );
            if (effectName && node.arguments.length >= 2) {
                if (isFunctionNode(node.arguments[0])) {
                    computations.set(node.arguments[0], {
                        api: effectName,
                        messageId: "writeInCompute"
                    });
                }
                return true;
            }
            return false;
        }

        return {
            ImportDeclaration: handleImportDeclaration,
            FunctionDeclaration: enterFunction,
            FunctionExpression: enterFunction,
            ArrowFunctionExpression: enterFunction,
            "FunctionDeclaration:exit": exitFunction,
            "FunctionExpression:exit": exitFunction,
            "ArrowFunctionExpression:exit": exitFunction,
            JSXElement: markJSX,
            JSXFragment: markJSX,
            CallExpression(node) {
                if (node.callee.type !== "Identifier") {
                    return;
                }
                // Ancestors are visited first, so a computation is known
                // before the setter calls inside it.
                if (registerComputation(node)) {
                    return;
                }
                const enclosing = findParent(node, isFunctionNode);
                if (!enclosing) {
                    return;
                }
                const computation = computations.get(enclosing);
                if (!isSetter(node.callee)) {
                    return;
                }
                if (computation) {
                    context.report({
                        data: { api: computation.api, name: node.callee.name },
                        messageId: computation.messageId,
                        node
                    });
                    return;
                }
                const pending = pendingComponentWrites.get(enclosing);
                if (pending) {
                    pending.push(node);
                } else {
                    pendingComponentWrites.set(enclosing, [node]);
                }
            }
        };
    }
};
