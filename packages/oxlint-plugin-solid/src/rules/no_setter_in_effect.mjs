import { getSourceCode } from "../compat.mjs";
import { isFunctionNode, trackImports } from "../utils.mjs";

const GETTER_INDEX = 0;
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
 * `const [value, setValue] = createSignal(...)` -> "value", and for `const [,
 * setValue]` the name the setter implies.
 */
function getGetterName(declarator, setterName) {
    const element = declarator.id.elements[GETTER_INDEX];
    if (element?.type === "Identifier") {
        return element.name;
    }

    const implied = /^set([A-Z])(.*)$/u.exec(setterName);

    return implied ? `${implied[1].toLowerCase()}${implied[2]}` : "value";
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

/** The first setter call anywhere in the phase, or null. */
function findSetterCall(node, setterNames) {
    if (node === null || typeof node !== "object") {
        return null;
    }

    if (isSetterCall(node, setterNames)) {
        return node;
    }

    for (const [key, value] of Object.entries(node)) {
        // `parent` points back up the tree; following it would not terminate.
        if (key === "parent") {
            continue;
        }

        const candidates = Array.isArray(value) ? value : [value];
        for (const candidate of candidates) {
            if (
                candidate !== null &&
                typeof candidate === "object" &&
                !isFunctionNode(candidate)
            ) {
                const found = findSetterCall(candidate, setterNames);
                if (found) {
                    return found;
                }
            }
        }
    }

    return null;
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
                isSetterCall(statement.expression, setterNames)
        )
    );
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow effects that only copy a reactive value into another signal or store.",
            url: "https://docs.solidjs.com/"
        },
        schema: [],
        messages: {
            asyncSetterInEffect:
                "This effect awaits and then writes the result with `{{setter}}`, so nothing shows that '{{getter}}' is loading, a rejection never reaches `<Errored>`, and a superseded run can overwrite a newer result. Fix: derive the value instead of storing it, `const {{getter}} = {{derivation}}`, read `{{getter}}()` under a `<Loading>` boundary, and drop `{{setter}}`; for nested data use the function form of `createStore`. Do not: add a flag or a run counter to drop stale results; Solid already does that for a derivation.",
            noSetterInEffect:
                "This effect only copies a value into '{{getter}}' with `{{setter}}`, so everything that reads '{{getter}}' paints a flush behind its source (Solid reports EFFECT_RELAY_TEAR in dev). Fix: derive it where it is read, `const {{getter}} = createMemo(() => …)` returning what `{{setter}}` receives; if '{{getter}}' is also edited locally, `const [{{getter}}, {{setter}}] = createSignal(() => …)`, which resets when the source changes. Do not: move the write into `onSettled` or `queueMicrotask`; that keeps the copy."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        // Setter name -> the name of the value it writes.
        const setterNames = new Map();
        const sourceCode = getSourceCode(context);

        /** What the fix derives `getter` from: the awaited call, if any. */
        function derivationFor(call) {
            const [argument] = call.arguments;
            if (argument?.type === "AwaitExpression") {
                const text = sourceCode.getText(argument.argument);
                if (!text.includes("\n")) {
                    return `createMemo(() => ${text})`;
                }
            }

            return "createMemo(async () => { … })";
        }

        function setterData(call) {
            return {
                derivation: derivationFor(call),
                getter: setterNames.get(call.callee.name),
                setter: call.callee.name
            };
        }

        return {
            ImportDeclaration: handleImportDeclaration,
            VariableDeclarator(node) {
                if (
                    node.init?.type !== "CallExpression" ||
                    node.init.callee.type !== "Identifier" ||
                    !matchImport(
                        ["createSignal", "createStore"],
                        node.init.callee.name
                    )
                ) {
                    return;
                }

                const setterName = getSetterName(node);
                if (setterName) {
                    setterNames.set(
                        setterName,
                        getGetterName(node, setterName)
                    );
                }
            },
            CallExpression(node) {
                if (
                    node.callee.type !== "Identifier" ||
                    !matchImport(
                        ["createEffect", "createRenderEffect"],
                        node.callee.name
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
                const write =
                    phase.async === true
                        ? findSetterCall(phase.body, setterNames)
                        : null;
                if (write) {
                    context.report({
                        data: setterData(write),
                        node: phase,
                        messageId: "asyncSetterInEffect"
                    });
                    return;
                }

                if (onlyWritesSignals(phase, setterNames)) {
                    context.report({
                        data: setterData(
                            findSetterCall(phase.body, setterNames)
                        ),
                        node: phase,
                        messageId: "noSetterInEffect"
                    });
                }
            }
        };
    }
};
