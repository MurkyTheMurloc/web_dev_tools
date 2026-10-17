import { findVariable } from "../compat.mjs";
import {
    isFunctionNode,
    isPropsByName,
    trackImports,
    walkOwnBody,
} from "../utils.mjs";

/**
 * Primitives whose first argument, when it is a function, is a reactive
 * computation. Solid 2.0 reads a promise returned from one like a value, so
 * the callback needs no `async` to be asynchronous.
 */
const COMPUTATION_PRIMITIVES = [
    "createMemo",
    "createOptimistic",
    "createOptimisticStore",
    "createProjection",
    "createSignal",
    "createStore",
];

/** The two-argument effects: the first function is the tracked compute phase. */
const EFFECT_PRIMITIVES = ["createEffect", "createRenderEffect"];

/** Primitives whose result is called to read it: `value()`. */
const ACCESSOR_PRIMITIVES = ["createMemo", "createOptimistic", "createSignal"];

/** Primitives whose result is read by property access: `store.items`. */
const STORE_PRIMITIVES = [
    "createOptimisticStore",
    "createProjection",
    "createStore",
];

const FIRST_ELEMENT = 0;

function getFirstBinding(declarator) {
    if (declarator.id.type === "ArrayPattern") {
        const element = declarator.id.elements[FIRST_ELEMENT];

        return element?.type === "Identifier" ? element : null;
    }

    return declarator.id.type === "Identifier" ? declarator.id : null;
}

function getStart(node) {
    return node.range?.[0] ?? node.start;
}

function getEnd(node) {
    return node.range?.[1] ?? node.end;
}

function isInsideTry(node, callback) {
    let current = node.parent;

    while (current && current !== callback) {
        if (current.type === "TryStatement") {
            return true;
        }

        current = current.parent;
    }

    return false;
}

/** `return await x` or `async () => await x`, and nothing else awaited. */
function isOnlyReturnAwait(callback, awaits) {
    if (awaits.length !== 1) {
        return false;
    }

    const [only] = awaits;
    if (callback.body === only) {
        return true;
    }

    // Inside `try`, `return await` is what makes the catch see a rejection.
    return only.parent?.type === "ReturnStatement" && !isInsideTry(only, callback);
}

export const reactiveAsyncRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Keep reads before the first await in async reactive computations and return promises without async.",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            untrackedReadAfterAwait:
                "'{{name}}' is read after an `await` in this `{{primitive}}` callback. Solid reports this as UNTRACKED_READ_AFTER_AWAIT: only reads before the first `await` are dependencies, so the result goes stale when it changes. Read it before the `await` and use the local afterwards: `const current = {{name}}; … await …`.",
            redundantAsync:
                "This `async` `{{primitive}}` callback only does `return await …`. Solid reads a returned promise like a value, so remove `async` and `await` and return the promise: `{{primitive}}(() => load(id()))`.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        // Identifier nodes that declare a reactive value, by what reading it
        // looks like. Lookup goes through the scope, so a shadowing local with
        // the same name is not mistaken for the signal.
        const accessors = new Set();
        const stores = new Set();

        function bindingKind(identifier) {
            const definition = findVariable(context, identifier)?.defs[0];
            const declared = definition?.name;
            if (accessors.has(declared)) {
                return "accessor";
            }

            return stores.has(declared) ? "store" : null;
        }

        function readName(candidate) {
            if (
                candidate.type === "CallExpression" &&
                candidate.callee.type === "Identifier" &&
                bindingKind(candidate.callee) === "accessor"
            ) {
                return candidate.callee.name;
            }

            if (
                candidate.type === "MemberExpression" &&
                candidate.object.type === "Identifier" &&
                candidate.property.type === "Identifier" &&
                !candidate.computed
            ) {
                const { name } = candidate.object;
                if (
                    isPropsByName(name) ||
                    bindingKind(candidate.object) === "store"
                ) {
                    return `${name}.${candidate.property.name}`;
                }
            }

            return null;
        }

        function checkCallback(callback, primitive) {
            const awaits = [];
            const reads = [];

            walkOwnBody(callback.body, (candidate) => {
                if (candidate.type === "AwaitExpression") {
                    awaits.push(candidate);
                }

                const name = readName(candidate);
                if (name !== null) {
                    reads.push({ name, node: candidate });
                }
            });

            if (awaits.length === 0) {
                return;
            }

            if (callback.async === true && isOnlyReturnAwait(callback, awaits)) {
                context.report({
                    node: callback,
                    messageId: "redundantAsync",
                    data: { primitive },
                });
            }

            // A read inside the awaited expression itself still runs before the
            // await suspends, so the boundary is where the first await ends.
            const firstAwaitEnd = Math.min(...awaits.map(getEnd));
            for (const read of reads) {
                if (getStart(read.node) >= firstAwaitEnd) {
                    context.report({
                        node: read.node,
                        messageId: "untrackedReadAfterAwait",
                        data: { name: read.name, primitive },
                    });
                }
            }
        }

        return {
            ImportDeclaration: handleImportDeclaration,
            VariableDeclarator(node) {
                if (
                    node.init?.type !== "CallExpression" ||
                    node.init.callee.type !== "Identifier"
                ) {
                    return;
                }

                const binding = getFirstBinding(node);
                if (!binding) {
                    return;
                }

                const callee = node.init.callee.name;
                if (matchImport(ACCESSOR_PRIMITIVES, callee)) {
                    accessors.add(binding);
                } else if (matchImport(STORE_PRIMITIVES, callee)) {
                    stores.add(binding);
                }
            },
            CallExpression(node) {
                if (node.callee.type !== "Identifier") {
                    return;
                }

                const [first, second] = node.arguments;
                if (!isFunctionNode(first)) {
                    return;
                }

                const computation = matchImport(
                    COMPUTATION_PRIMITIVES,
                    node.callee.name,
                );
                if (computation) {
                    checkCallback(first, computation);
                    return;
                }

                // A lone function is the whole effect, not a compute phase.
                const effect = matchImport(EFFECT_PRIMITIVES, node.callee.name);
                if (effect && isFunctionNode(second)) {
                    checkCallback(first, effect);
                }
            },
        };
    },
};
