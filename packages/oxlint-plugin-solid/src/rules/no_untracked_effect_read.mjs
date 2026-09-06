import { isFunctionNode, isPropsByName, trackImports } from "../utils.mjs";

const GETTER_INDEX = 0;

/** `const [value, setValue] = createSignal(...)` -> "value". */
function getGetterName(declarator) {
    if (declarator.id.type !== "ArrayPattern") {
        return null;
    }

    const element = declarator.id.elements[GETTER_INDEX];

    return element?.type === "Identifier" ? element.name : null;
}

/** Every name a function's parameters bind, however they are destructured. */
function collectParameterNames(fn, into) {
    const pending = [...fn.params];

    while (pending.length > 0) {
        const pattern = pending.pop();
        if (pattern === null || typeof pattern !== "object") {
            continue;
        }

        if (pattern.type === "Identifier") {
            into.add(pattern.name);
            continue;
        }

        for (const [key, value] of Object.entries(pattern)) {
            if (key === "parent") {
                continue;
            }

            const candidates = Array.isArray(value) ? value : [value];
            for (const candidate of candidates) {
                if (candidate !== null && typeof candidate === "object") {
                    pending.push(candidate);
                }
            }
        }
    }
}

/**
 * Walk the phase body, stopping at nested functions.
 *
 * A read inside a nested function runs whenever that function is called, which
 * is a different question from whether this phase subscribes to it.
 */
function walkPhase(node, visit) {
    if (node === null || typeof node !== "object") {
        return;
    }

    visit(node);

    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }

        const candidates = Array.isArray(value) ? value : [value];
        for (const candidate of candidates) {
            if (
                candidate !== null &&
                typeof candidate === "object" &&
                typeof candidate.type === "string" &&
                !isFunctionNode(candidate)
            ) {
                walkPhase(candidate, visit);
            }
        }
    }
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow reading reactive values in the untracked apply phase of an effect.",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            untrackedEffectRead:
                "'{{name}}' is read in the effect's apply phase, which runs untracked — changes to it will not re-run this effect. Read it in the compute phase and take it as an argument instead.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const getterNames = new Set();

        return {
            ImportDeclaration: handleImportDeclaration,
            VariableDeclarator(node) {
                if (
                    node.init?.type !== "CallExpression" ||
                    node.init.callee.type !== "Identifier" ||
                    !matchImport(["createSignal"], node.init.callee.name)
                ) {
                    return;
                }

                const getterName = getGetterName(node);
                if (getterName) {
                    getterNames.add(getterName);
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

                // Only the two-argument form has an apply phase. A lone
                // function is the whole effect and tracks throughout.
                const [compute, apply] = node.arguments;
                if (!compute || !apply || !isFunctionNode(apply)) {
                    return;
                }

                // Whatever the compute phase handed over arrives as a
                // parameter, so those names are already settled values.
                const settled = new Set();
                collectParameterNames(apply, settled);

                walkPhase(apply.body, (candidate) => {
                    // `signal()` — a getter call that did not come through the
                    // compute phase.
                    if (
                        candidate.type === "CallExpression" &&
                        candidate.callee.type === "Identifier" &&
                        getterNames.has(candidate.callee.name) &&
                        !settled.has(candidate.callee.name)
                    ) {
                        context.report({
                            node: candidate,
                            messageId: "untrackedEffectRead",
                            data: { name: candidate.callee.name },
                        });
                        return;
                    }

                    // `props.value` — a props read is reactive for the same
                    // reason and is just as invisible to the tracker here.
                    if (
                        candidate.type === "MemberExpression" &&
                        !candidate.computed &&
                        candidate.object.type === "Identifier" &&
                        isPropsByName(candidate.object.name) &&
                        !settled.has(candidate.object.name) &&
                        candidate.property.type === "Identifier"
                    ) {
                        context.report({
                            node: candidate,
                            messageId: "untrackedEffectRead",
                            data: {
                                name: `${candidate.object.name}.${candidate.property.name}`,
                            },
                        });
                    }
                });
            },
        };
    },
};
