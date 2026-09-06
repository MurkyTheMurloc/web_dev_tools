import { isFunctionNode, trackImports } from "../utils.mjs";

const SETTER_INDEX = 1;

/** `const [value, setValue] = createSignal(...)` -> "setValue". */
function getSetterName(declarator) {
    if (declarator.id.type !== "ArrayPattern") {
        return null;
    }

    const element = declarator.id.elements[SETTER_INDEX];

    return element?.type === "Identifier" ? element.name : null;
}

/**
 * The phase that runs untracked and performs the work. Solid 2.0 passes it as
 * the second argument; a lone function is still the whole effect.
 */
function getEffectPhase(node) {
    const [compute, apply] = node.arguments;

    if (apply) {
        return isFunctionNode(apply) ? apply : null;
    }

    return isFunctionNode(compute) ? compute : null;
}

function isSetterCall(node, setterNames) {
    return (
        node?.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        setterNames.has(node.callee.name)
    );
}

/** True when any statement anywhere in the phase writes to a signal or store. */
function writesSignalsAnywhere(node, setterNames) {
    if (node === null || typeof node !== "object") {
        return false;
    }

    if (isSetterCall(node, setterNames)) {
        return true;
    }

    return Object.entries(node).some(([key, value]) => {
        // `parent` points back up the tree; following it would not terminate.
        if (key === "parent") {
            return false;
        }

        const candidates = Array.isArray(value) ? value : [value];

        return candidates.some(
            (candidate) =>
                candidate !== null &&
                typeof candidate === "object" &&
                !isFunctionNode(candidate) &&
                writesSignalsAnywhere(candidate, setterNames),
        );
    });
}

/** True when the phase does nothing but write to signals or stores. */
function onlyWritesSignals(phase, setterNames) {
    if (phase.body.type !== "BlockStatement") {
        return isSetterCall(phase.body, setterNames);
    }

    const { body } = phase.body;

    return (
        body.length > 0 &&
        body.every(
            (statement) =>
                statement.type === "ExpressionStatement" &&
                isSetterCall(statement.expression, setterNames),
        )
    );
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow effects that only copy a reactive value into another signal or store.",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            asyncSetterInEffect:
                "This effect awaits and then writes the result into a signal or store. Return the value from a derivation instead: `createMemo(async () => ...)`, or the function form of `createStore` for nested data. Solid coordinates readiness, error propagation, and dropping superseded runs.",
            noSetterInEffect:
                "This effect only writes to a signal or store. Calculate the value where it is read instead: a derived function, `createMemo`, or a writable derived `createSignal(() => ...)` for a local override.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const setterNames = new Set();

        return {
            ImportDeclaration: handleImportDeclaration,
            VariableDeclarator(node) {
                if (
                    node.init?.type !== "CallExpression" ||
                    node.init.callee.type !== "Identifier" ||
                    !matchImport(
                        ["createSignal", "createStore"],
                        node.init.callee.name,
                    )
                ) {
                    return;
                }

                const setterName = getSetterName(node);
                if (setterName) {
                    setterNames.add(setterName);
                }
            },
            CallExpression(node) {
                if (
                    node.callee.type !== "Identifier" ||
                    !matchImport(
                        ["createEffect", "createRenderEffect"],
                        node.callee.name,
                    )
                ) {
                    return;
                }

                const phase = getEffectPhase(node);
                if (!phase) {
                    return;
                }

                // Asynchrony is checked first because it is the more specific
                // diagnosis: `onlyWritesSignals` also matches a lone
                // `setResults(await search(q))`, and the async message is the
                // one that names readiness and superseded runs.
                //
                // `onlyWritesSignals` never sees the multi-statement shape at
                // all — the `await` is not a setter call — which is why an
                // async phase gets its own search.
                if (
                    phase.async === true &&
                    writesSignalsAnywhere(phase.body, setterNames)
                ) {
                    context.report({
                        node: phase,
                        messageId: "asyncSetterInEffect",
                    });
                    return;
                }

                if (onlyWritesSignals(phase, setterNames)) {
                    context.report({
                        node: phase,
                        messageId: "noSetterInEffect",
                    });
                }
            },
        };
    },
};
