import { getSourceCode } from "../compat.mjs";
import { isFunctionNode, trackImports, walkOwnBody } from "../utils.mjs";

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

/**
 * The first setter call in the effect function whose value the compute function
 * reads: `count()` for a signal, `store.x` (or `store` itself) for a store.
 */
function findOwnSourceWrite(node, setterNames, sourceGetters) {
    const [compute, effectFn] = node.arguments;
    if (!isFunctionNode(compute) || !isFunctionNode(effectFn)) {
        return null;
    }

    const reads = new Set();
    walkOwnBody(compute.body, (candidate) => {
        if (
            candidate.type === "CallExpression" &&
            candidate.callee.type === "Identifier"
        ) {
            reads.add(candidate.callee.name);
        } else if (
            candidate.type === "MemberExpression" &&
            candidate.object.type === "Identifier"
        ) {
            reads.add(candidate.object.name);
        } else if (
            candidate.type === "Identifier" &&
            candidate === compute.body
        ) {
            reads.add(candidate.name);
        }
    });

    let write = null;
    walkOwnBody(effectFn.body, (candidate) => {
        write ??=
            isSetterCall(candidate, setterNames) &&
            reads.has(sourceGetters.get(candidate.callee.name))
                ? candidate
                : null;
    });

    return write;
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
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/docs/solid-2-effects.md"
        },
        schema: [],
        messages: {
            asyncSetterInEffect:
                "This effect awaits and then writes the result with `{{setter}}`, so nothing shows that '{{getter}}' is loading, a rejection never reaches `<Errored>`, and a superseded run can overwrite a newer one (Solid reports EFFECT_RELAY_TEAR). Fix: derive the value with an async memo, `const {{getter}} = {{derivation}}`, read `{{getter}}()` inside `<Loading>` and `<Errored>`, and drop `{{setter}}` and the effect; for a list whose items keep identity use `createStore(async () => …, seed)`. Do not: add a loading flag or a run counter to drop stale results (Solid drops a superseded run's answer itself), move the write into `onSettled`, or disable the rule.",
            effectWritesOwnSource:
                "`{{setter}}` in the effect function writes '{{getter}}', which the compute function reads, so each change runs the effect twice and paints the pre-write value in between (Solid reports EFFECT_WRITES_OWN_SOURCE). Fix: compute the written value in a memo, `const next{{Getter}} = createMemo(() => …)`, read that where '{{getter}}' is read and delete the write; if the write normalizes '{{getter}}', normalize where it is written, in the handler or action that calls `{{setter}}`. Do not: guard the write with an `if` or a flag, read '{{getter}}' with `untrack()` or in the effect function instead of the compute function, or disable the rule.",
            noSetterInEffect:
                "This effect only copies a value into '{{getter}}' with `{{setter}}`, so everything that reads '{{getter}}' paints one flush behind its source (Solid reports EFFECT_RELAY_TEAR in dev). Fix: delete the effect and the signal and derive the value where it is read, with a plain function, `const {{getter}} = () => …`, or `createMemo(() => …)` when several readers share it, returning what `{{setter}}` receives; if '{{getter}}' is a local editable copy, use a writable derivation, `const [{{getter}}, {{setter}}] = createSignal(() => props.value)`, or `createStore(() => props.x, seed)` for nested data, which resets when the source changes; for async data use an async `createMemo` read inside `<Loading>` and `<Errored>`. Do not: move the write into `onSettled` or `queueMicrotask`, wrap it in `untrack()`, or disable the rule; each keeps the copy."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        // Setter name -> the name of the value it writes.
        const setterNames = new Map();
        // Setter name -> the getter that reads its value, when there is one.
        const sourceGetters = new Map();
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
                    const getter = node.id.elements[GETTER_INDEX];
                    if (getter?.type === "Identifier") {
                        sourceGetters.set(setterName, getter.name);
                    }
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
                    return;
                }

                const ownWrite = findOwnSourceWrite(
                    node,
                    setterNames,
                    sourceGetters
                );
                if (ownWrite) {
                    const getter = setterNames.get(ownWrite.callee.name);
                    context.report({
                        data: {
                            Getter: `${getter[0].toUpperCase()}${getter.slice(1)}`,
                            getter,
                            setter: ownWrite.callee.name
                        },
                        node: ownWrite,
                        messageId: "effectWritesOwnSource"
                    });
                }
            }
        };
    }
};
