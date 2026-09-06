import { ESLintUtils } from "@typescript-eslint/utils";

import { isFunctionNode, jsxPropName, trackImports } from "../utils.mjs";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

/**
 * Primitives that attach to the current owner.
 *
 * An effect or memo created without an owner is never disposed, and a cleanup
 * registered without one never runs.
 */
const OWNED_PRIMITIVES = [
    "createEffect",
    "createMemo",
    "createProjection",
    "createReaction",
    "createRenderEffect",
    "onCleanup",
    "onSettled",
];

/** The callbacks a `ref` prop applies, including the ones in a ref array. */
function getRefCallbacks(expression) {
    if (isFunctionNode(expression)) {
        return [expression];
    }

    // `ref={[storeElement, autofocus, listen(...)]}` — Solid flattens the array
    // and calls each entry, so an inline callback anywhere in it is a ref
    // callback like any other.
    if (expression?.type === "ArrayExpression") {
        return expression.elements.flatMap((element) =>
            element !== null && isFunctionNode(element) ? [element] : [],
        );
    }

    return [];
}

/**
 * Walk a callback body, stopping at nested functions.
 *
 * Only calls the ref callback makes itself are reported. A nested function may
 * be handed to something that supplies an owner, and guessing wrong would flag
 * working code.
 */
function walkOwnBody(node, visit) {
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
                walkOwnBody(candidate, visit);
            }
        }
    }
}

export default createRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow creating owner-bound primitives inside a ref callback.",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            ownedPrimitiveInRef:
                "`{{name}}` is called inside a ref callback, which runs without an owner — nothing will ever dispose it. Create it in the directive factory instead, and let the returned callback only store the element.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();

        return {
            ImportDeclaration: handleImportDeclaration,
            JSXAttribute(node) {
                if (jsxPropName(node) !== "ref") {
                    return;
                }

                if (node.value?.type !== "JSXExpressionContainer") {
                    return;
                }

                for (const callback of getRefCallbacks(node.value.expression)) {
                    walkOwnBody(callback.body, (candidate) => {
                        if (
                            candidate.type !== "CallExpression" ||
                            candidate.callee.type !== "Identifier" ||
                            !matchImport(
                                OWNED_PRIMITIVES,
                                candidate.callee.name,
                            )
                        ) {
                            return;
                        }

                        context.report({
                            node: candidate,
                            messageId: "ownedPrimitiveInRef",
                            data: { name: candidate.callee.name },
                        });
                    });
                }
            },
        };
    },
});
