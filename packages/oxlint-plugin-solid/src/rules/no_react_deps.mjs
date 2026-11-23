// Solid 2.0 has no dependency arrays. `createEffect(compute, effectFn)` tracks
// what compute reads and runs effectFn untracked; `createMemo(fn, options)`
// tracks what fn reads. A React-style array lands where Solid expects the
// effect function or the options object.
import { getSourceCode } from "../compat.mjs";
import {
    appendImports,
    getGetterName,
    isFunctionNode,
    isPropsByName,
    localName,
    messageCode,
    trace,
    trackImports,
    walkOwnBody
} from "../utils.mjs";

const EFFECTS = ["createEffect", "createRenderEffect"];
const ACCESSOR_PAIRS = ["createSignal", "createOptimistic"];
const SECOND = 1;
const THIRD = 2;

/**
 * The normalized read `node` stands for: `a()` for a call without arguments,
 * `props.id` for a props member. Null for anything else.
 */
function readText(node) {
    if (
        node?.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        node.arguments.length === 0
    ) {
        return `${node.callee.name}()`;
    }

    if (
        node?.type === "MemberExpression" &&
        !node.computed &&
        node.object.type === "Identifier" &&
        isPropsByName(node.object.name) &&
        node.property.type === "Identifier"
    ) {
        return `${node.object.name}.${node.property.name}`;
    }

    return null;
}

/**
 * Each dep as `{ key, read }`: accessor `a` -> `a: a()`, `a()` -> `a: a()`,
 * `props.id` -> `id: props.id`. Null unless every dep resolves and no two claim
 * the same key.
 */
function resolveDeps(array, accessors) {
    const byKey = new Map();
    for (const element of array.elements) {
        const read =
            element?.type === "Identifier" && accessors.has(element.name)
                ? `${element.name}()`
                : readText(element);
        if (read === null) {
            return null;
        }

        const key = localName(read.replace(/\(\)$/u, ""));
        if (byKey.has(key) && byKey.get(key) !== read) {
            return null;
        }
        byKey.set(key, read);
    }

    return [...byKey].map(([key, read]) => ({ key, read }));
}

/** A name that is not a variable reference: `obj.id`, `{ id: 1 }`. */
function isNonReference(node) {
    const { parent } = node;

    return (
        (parent?.type === "MemberExpression" &&
            parent.property === node &&
            !parent.computed) ||
        (parent?.type === "Property" &&
            parent.key === node &&
            !parent.computed &&
            !parent.shorthand)
    );
}

/**
 * The function's body with each dep read replaced by its parameter, or null
 * when a parameter would shadow a name the body still uses.
 */
function rewriteBody(fn, deps, sourceCode) {
    const keyByRead = new Map(deps.map(({ key, read }) => [read, key]));
    const keys = new Set(deps.map(({ key }) => key));
    const edits = [];
    let clean = true;

    // Nested functions are not rewritten (a read there is a live read, not
    // the snapshot), but a parameter would still shadow their names.
    const visit = (node, nested) => {
        const read = readText(node);
        if (!nested && keyByRead.has(read)) {
            edits.push({ key: keyByRead.get(read), range: node.range });
            return;
        }
        if (
            node.type === "Identifier" &&
            keys.has(node.name) &&
            !isNonReference(node)
        ) {
            clean = false;
        }
        for (const [field, value] of Object.entries(node)) {
            if (field === "parent") {
                continue;
            }
            for (const child of [value].flat()) {
                if (typeof child?.type === "string") {
                    visit(child, nested || isFunctionNode(child));
                }
            }
        }
    };
    visit(fn.body, false);
    if (!clean) {
        return null;
    }

    const [start] = fn.body.range;
    let text = sourceCode.getText(fn.body);
    for (const { key, range } of edits.toSorted(
        (left, right) => right.range[0] - left.range[0]
    )) {
        text = `${text.slice(0, range[0] - start)}${key}${text.slice(range[1] - start)}`;
    }

    // `() => ({ … })` loses its parentheses in getText.
    return fn.body.type !== "BlockStatement" && text.startsWith("{")
        ? `(${text})`
        : text;
}

function computeText(deps) {
    return `() => ({ ${deps.map(({ key, read }) => `${key}: ${read}`).join(", ")} })`;
}

function paramsText(deps) {
    return `{ ${deps.map(({ key }) => key).join(", ")} }`;
}

/** `createEffect(() => ({ a: a() }), ({ a }) => { … })` for the message. */
function effectFixText(name, deps) {
    return deps
        ? `${name}(${computeText(deps)}, (${paramsText(deps)}) => { … })`
        : `${name}(() => ({ value: source() }), ({ value }) => { … })`;
}

/** The effect function the single function becomes. */
function effectFunctionText(fn, deps, body) {
    const prefix = fn.async ? "async " : "";
    if (fn.type === "ArrowFunctionExpression") {
        return `${prefix}(${paramsText(deps)}) => ${body}`;
    }

    return `${prefix}function${fn.generator ? "*" : ""} (${paramsText(deps)}) ${body}`;
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow dependency arrays in `createEffect`, `createRenderEffect` and `createMemo`.",
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/docs/solid-2-effects.md"
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
            effectDeps:
                "`{{name}}` gets the dependency array `{{deps}}`, but Solid 2.0 has no dependency arrays: the compute function tracks what it reads, and the second argument must be the effect function. Fix: `{{fix}}`, reading each dependency in the compute function and moving the body into the effect function, which uses the parameters and still returns its cleanup. Do not: only delete the array (a one-argument `{{name}}` throws MISSING_EFFECT_FN), keep reading signals in the effect function (it runs untracked, so the effect stops re-running), wrap reads in `untrack()`, or disable the rule.",
            effectMountDeps:
                "`{{name}}` gets the empty dependency array `[]`, React's run-once idiom, but Solid 2.0 has no dependency arrays and expects the effect function there. Fix: `onSettled(() => { …; return cleanup; })` for one-time setup after mount; it runs once the render has settled and runs the returned cleanup on disposal. Do not: only delete the array (a one-argument `{{name}}` throws MISSING_EFFECT_FN), call `onCleanup` inside `onSettled` (Solid throws CLEANUP_IN_FORBIDDEN_SCOPE), or disable the rule.",
            effectOptionsDeps:
                "`{{name}}` gets the dependency array `{{deps}}` in the options slot, so it does nothing: the effect re-runs on what its compute function reads. Fix: delete `{{deps}}` and read those values in the compute function, `{{fix}}`. Do not: read them in the effect function (it runs untracked), wrap reads in `untrack()`, or disable the rule.",
            memoDeps:
                "`{{name}}` gets the dependency array `{{deps}}`, but Solid 2.0 has no dependency arrays: the memo tracks what its function reads, and the array lands in the options slot. Fix: delete `{{deps}}`, `{{fix}}`{{unread}}. Do not: move the array into the options object, wrap reads in `untrack()`, or disable the rule.",
            deleteDeps: "Delete the dependency array.",
            splitEffect:
                "Split into a compute function and an effect function.",
            useOnSettled: "Use `onSettled` for the one-time setup."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const sourceCode = getSourceCode(context);
        // Names that hold an accessor, so `[count]` can become `count()`.
        const accessors = new Set();
        let solidImport = null;
        let onSettledName = null;

        function reportEffect(node, fn, array) {
            const name = node.callee.name;
            const arg = node.arguments[SECOND];
            const inline = arg === array && fn === node.arguments[0];

            if (array.elements.length === 0) {
                const importNode = onSettledName ? null : solidImport;
                const canFix =
                    node.arguments.length === 2 &&
                    arg === array &&
                    (onSettledName !== null || importNode !== null);
                context.report({
                    data: { name },
                    messageId: "effectMountDeps",
                    node: arg,
                    suggest: canFix
                        ? [
                              {
                                  messageId: "useOnSettled",
                                  fix: (fixer) => [
                                      fixer.replaceText(
                                          node,
                                          `${onSettledName ?? "onSettled"}(${sourceCode.getText(node.arguments[0])})`
                                      ),
                                      ...(importNode
                                          ? [
                                                appendImports(
                                                    fixer,
                                                    sourceCode,
                                                    importNode,
                                                    ["onSettled"]
                                                )
                                            ]
                                          : [])
                                  ]
                              }
                          ]
                        : []
                });
                return;
            }

            const deps = resolveDeps(array, accessors);
            const body = deps && inline && rewriteBody(fn, deps, sourceCode);
            context.report({
                data: {
                    deps: messageCode(sourceCode.getText(arg), "[…]"),
                    fix: effectFixText(name, deps),
                    name
                },
                messageId: "effectDeps",
                node: arg,
                // Never an autofix: the rewrite moves reads between phases.
                suggest: body
                    ? [
                          {
                              messageId: "splitEffect",
                              fix: (fixer) =>
                                  fixer.replaceTextRange(
                                      [fn.range[0], array.range[1]],
                                      `${computeText(deps)}, ${effectFunctionText(fn, deps, body)}`
                                  )
                          }
                      ]
                    : []
            });
        }

        function reportEffectOptions(node, array) {
            const name = node.callee.name;
            const arg = node.arguments[THIRD];
            context.report({
                data: {
                    deps: messageCode(sourceCode.getText(arg), "[…]"),
                    fix: effectFixText(name, resolveDeps(array, accessors)),
                    name
                },
                messageId: "effectOptionsDeps",
                node: arg,
                suggest:
                    arg === array
                        ? [
                              {
                                  messageId: "deleteDeps",
                                  fix: (fixer) =>
                                      fixer.removeRange([
                                          node.arguments[SECOND].range[1],
                                          arg.range[1]
                                      ])
                              }
                          ]
                        : []
            });
        }

        function reportMemo(node, fn, array, index) {
            const arg = node.arguments[index];
            // What the memo's function reads itself.
            const reads = new Set();
            if (isFunctionNode(fn)) {
                walkOwnBody(fn.body, (candidate) => {
                    const read = readText(candidate);
                    if (read) {
                        reads.add(read);
                    }
                });
            }
            const unread = array.elements.flatMap((element) => {
                const read =
                    element?.type === "Identifier"
                        ? `${element.name}()`
                        : readText(element);

                return read && reads.has(read)
                    ? []
                    : [messageCode(sourceCode.getText(element), "…")];
            });
            const remove = (fixer) => fixer.remove(arg);
            context.report({
                data: {
                    deps: messageCode(sourceCode.getText(arg), "[…]"),
                    fix: `${node.callee.name}(${messageCode(sourceCode.getText(node.arguments[0]), "() => …")})`,
                    name: node.callee.name,
                    unread:
                        unread.length === 0
                            ? ""
                            : `; ${unread.map((text) => `\`${text}\``).join(", ")} ${unread.length === 1 ? "is" : "are"} not read in the function, so read ${unread.length === 1 ? "it" : "them"} there if the memo must recompute when ${unread.length === 1 ? "it changes" : "they change"}`
                },
                // Safe only when the function already reads every dep.
                fix: arg === array && unread.length === 0 ? remove : undefined,
                messageId: "memoDeps",
                node: arg,
                suggest:
                    arg === array && unread.length > 0
                        ? [{ messageId: "deleteDeps", fix: remove }]
                        : []
            });
        }

        return {
            ImportDeclaration(node) {
                handleImportDeclaration(node);
                if (node.source.value === "solid-js") {
                    solidImport ??= node;
                    for (const specifier of node.specifiers) {
                        if (specifier.imported?.name === "onSettled") {
                            onSettledName = specifier.local.name;
                        }
                    }
                }
            },
            VariableDeclarator(node) {
                if (
                    node.init?.type !== "CallExpression" ||
                    node.init.callee.type !== "Identifier"
                ) {
                    return;
                }
                if (matchImport(ACCESSOR_PAIRS, node.init.callee.name)) {
                    const getter = getGetterName(node);
                    if (getter) {
                        accessors.add(getter);
                    }
                } else if (
                    matchImport("createMemo", node.init.callee.name) &&
                    node.id.type === "Identifier"
                ) {
                    accessors.add(node.id.name);
                }
            },
            CallExpression(node) {
                if (
                    node.callee.type !== "Identifier" ||
                    node.arguments.length < 2 ||
                    node.arguments.some((arg) => arg.type === "SpreadElement")
                ) {
                    return;
                }
                const isEffect = Boolean(
                    matchImport(EFFECTS, node.callee.name)
                );
                if (!isEffect && !matchImport("createMemo", node.callee.name)) {
                    return;
                }

                // Trace variables to their values; a reported variable is
                // highlighted at the call, not at its declaration.
                const [fn, second, third] = node.arguments.map((arg) =>
                    trace(arg, context)
                );
                if (
                    second.type === "ArrayExpression" &&
                    isFunctionNode(fn) &&
                    // With a parameter, the second argument can be a seed.
                    fn.params.length === 0
                ) {
                    if (isEffect) {
                        reportEffect(node, fn, second);
                    } else {
                        reportMemo(node, fn, second, SECOND);
                    }
                    return;
                }
                if (third?.type === "ArrayExpression") {
                    if (isEffect) {
                        reportEffectOptions(node, third);
                    } else {
                        reportMemo(node, fn, third, THIRD);
                    }
                }
            }
        };
    }
};
