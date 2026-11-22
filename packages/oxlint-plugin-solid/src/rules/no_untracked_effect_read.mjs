import { getSourceCode } from "../compat.mjs";
import {
    getGetterName,
    isFunctionNode,
    isPropsByName,
    localName,
    trackImports
} from "../utils.mjs";

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

/** The apply's first parameter when it is a plain identifier. */
function valueName(apply) {
    const [first] = apply.params;

    return first?.type === "Identifier" ? first.name : "value";
}

/**
 * The effect with `read` moved into its compute, which hands both values over
 * as one object: `({ value: <the compute's expression>, local: read })`.
 */
function buildFix(sourceCode, api, compute, apply, read, local) {
    const computed =
        isFunctionNode(compute) &&
        compute.body.type !== "BlockStatement" &&
        compute.body.type !== "ObjectExpression"
            ? sourceCode.getText(compute.body)
            : "…";
    const quoted = computed.includes("\n") ? "…" : computed;
    const value = valueName(apply);

    return `${api}(() => ({ ${value}: ${quoted}, ${local}: ${read} }), ({ ${value}, ${local} }) => { … })`;
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow reading reactive values in the untracked apply phase of an effect.",
            url: "https://docs.solidjs.com/"
        },
        schema: [],
        messages: {
            untrackedEffectRead:
                "`{{read}}` is read in the apply phase of `{{api}}`, which runs untracked, so a change to '{{name}}' does not re-run this effect. Fix: read it in the compute and take it as an argument, `{{fix}}`, then use `{{local}}` in place of `{{read}}`."
        }
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
                        node.callee.name
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
                const sourceCode = getSourceCode(context);
                const report = (candidate, name) => {
                    const read = sourceCode.getText(candidate);
                    const short = localName(name);
                    // `(title) => … props.title` would bind `title` twice.
                    const local =
                        short === valueName(apply) ? `${short}Read` : short;
                    context.report({
                        node: candidate,
                        messageId: "untrackedEffectRead",
                        data: {
                            api: node.callee.name,
                            fix: buildFix(
                                sourceCode,
                                node.callee.name,
                                compute,
                                apply,
                                read,
                                local
                            ),
                            local,
                            name,
                            read
                        }
                    });
                };

                walkPhase(apply.body, (candidate) => {
                    // `signal()` — a getter call that did not come through the
                    // compute phase.
                    if (
                        candidate.type === "CallExpression" &&
                        candidate.callee.type === "Identifier" &&
                        getterNames.has(candidate.callee.name) &&
                        !settled.has(candidate.callee.name)
                    ) {
                        report(candidate, candidate.callee.name);
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
                        report(
                            candidate,
                            `${candidate.object.name}.${candidate.property.name}`
                        );
                    }
                });
            }
        };
    }
};
