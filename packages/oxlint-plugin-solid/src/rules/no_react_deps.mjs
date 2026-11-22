import { getSourceCode } from "../compat.mjs";
import { isFunctionNode, messageCode, trace, trackImports } from "../utils.mjs";
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow usage of dependency arrays in `createEffect` and `createMemo`.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-deps.md"
        },
        fixable: "code",
        schema: [],
        messages: {
            noUselessDep:
                "`{{name}}` gets the dependency array `{{deps}}`. Solid 2.0 has no dependency arrays: it tracks what the compute function reads, and the second argument is {{second}}. Fix: {{fix}}"
        }
    },
    defaultOptions: [],
    create(context) {
        /** Tracks imports from 'solid-js', handling aliases. */
        const { matchImport, handleImportDeclaration } = trackImports();
        return {
            ImportDeclaration: handleImportDeclaration,
            CallExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    matchImport(
                        ["createEffect", "createMemo"],
                        node.callee.name
                    ) &&
                    node.arguments.length === 2 &&
                    node.arguments.every((arg) => arg.type !== "SpreadElement")
                ) {
                    // grab both arguments, tracing any variables to their actual values if possible
                    const [arg0, arg1] = node.arguments.map((arg) =>
                        trace(arg, context)
                    );
                    if (
                        isFunctionNode(arg0) &&
                        arg0.params.length === 0 &&
                        arg1.type === "ArrayExpression"
                    ) {
                        // A second argument that looks like a dependency array was passed to
                        // createEffect/createMemo, and the inline function doesn't accept a parameter, so it
                        // can't just be an initial value.
                        const deps = messageCode(
                            getSourceCode(context).getText(node.arguments[1]),
                            "[…]"
                        );
                        const isEffect =
                            matchImport("createEffect", node.callee.name) ===
                            "createEffect";
                        context.report({
                            node: node.arguments[1], // if this is a variable, highlight the usage, not the initialization
                            messageId: "noUselessDep",
                            data: {
                                name: node.callee.name,
                                deps,
                                // createEffect(compute, apply) and
                                // createMemo(compute, options) in Solid 2.0.
                                second: isEffect
                                    ? "the apply function"
                                    : "the options object",
                                fix: isEffect
                                    ? `\`${node.callee.name}(() => ${deps}, (values) => { … })\`, with the side effect moved into apply. Do not: only delete the array; a one-argument \`createEffect\` is an error in 2.0.`
                                    : `delete \`${deps}\`; \`${node.callee.name}\` already tracks what its function reads.`
                            },
                            // remove dep array if it's given inline, otherwise don't fix
                            fix:
                                arg1 === node.arguments[1]
                                    ? (fixer) => fixer.remove(arg1)
                                    : undefined
                        });
                    }
                }
            }
        };
    }
};
