import { ESLintUtils } from "@typescript-eslint/utils";

import { getSourceCode } from "../compat.mjs";
import { appendImports, insertImports, removeSpecifier } from "../utils.mjs";
const createRule = ESLintUtils.RuleCreator.withoutDocs;
// Solid 2.0 moved the renderers into `@solidjs/*` packages and pulled the store
// APIs into the core. Symbols that are legitimately exported from more than one
// package (the control-flow components, `ComponentProps`) are deliberately left
// out of these maps: there is no single correct source to point at.
const primitiveMap = new Map();
for (const primitive of [
    "action",
    "affects",
    "children",
    "createContext",
    "createEffect",
    // The primitive forms of `Loading`, `Errored` and `Reveal`. Only custom
    // boundary components and renderer integrations reach for them, which is
    // why they were missing here — and why a wrong-module import of one went
    // unreported while every neighbouring primitive was checked.
    "createErrorBoundary",
    "createLoadingBoundary",
    "createMemo",
    "createOptimistic",
    "createOptimisticStore",
    "createProjection",
    "createReaction",
    "createRenderEffect",
    "createRevealOrder",
    "createRoot",
    "createSignal",
    "createStore",
    "createUniqueId",
    "deep",
    "DEV",
    "flush",
    "getObserver",
    "getOwner",
    "isEqual",
    "isPending",
    "latest",
    "lazy",
    "mapArray",
    "merge",
    "omit",
    "onCleanup",
    "onSettled",
    "reconcile",
    "refresh",
    "resolve",
    "runWithOwner",
    "snapshot",
    "storePath",
    "untrack",
    "until",
    "useContext",
]) {
    primitiveMap.set(primitive, "solid-js");
}
for (const primitive of [
    "clientOnly",
    "delegateEvents",
    "dynamic",
    "Dynamic",
    "generateHydrationScript",
    "getRequestEvent",
    "httpHeader",
    "httpStatus",
    "hydrate",
    "HydrationScript",
    "isServer",
    "Portal",
    "redirect",
    "reload",
    "render",
    "renderToStream",
    "renderToString",
]) {
    primitiveMap.set(primitive, "@solidjs/web");
}
// Set up map of type imports to module
const typeMap = new Map();
for (const type of [
    "Accessor",
    "ChildrenReturn",
    "Component",
    "Context",
    "Element",
    "FlowComponent",
    "FlowProps",
    "MatchProps",
    "ParentComponent",
    "ParentProps",
    "Ref",
    "ResolvedChildren",
    "Signal",
    "ValidComponent",
    "VoidComponent",
    "VoidProps",
]) {
    typeMap.set(type, "solid-js");
}
for (const type of ["ClassValue", "IntrinsicElement", "JSX", "RequestEvent"]) {
    typeMap.set(type, "@solidjs/web");
}
const sourceRegex = /^(?:solid-js|@solidjs\/(?:web|h|html|universal))$/;
const isSource = (source) => sourceRegex.test(source);
export default createRule({
    meta: {
        type: "suggestion",
        docs: {
            description:
                'Enforce consistent imports from "solid-js" and the `@solidjs/*` renderer packages.',
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/imports.md",
        },
        fixable: "code",
        schema: [],
        messages: {
            "prefer-source": 'Prefer importing {{name}} from "{{source}}".',
        },
    },
    defaultOptions: [],
    create(context) {
        return {
            ImportDeclaration(node) {
                const source = node.source.value;
                if (!isSource(source)) return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier") {
                        const isType =
                            specifier.importKind === "type" ||
                            node.importKind === "type";
                        const map = isType ? typeMap : primitiveMap;
                        const correctSource = map.get(specifier.imported.name);
                        if (correctSource != null && correctSource !== source) {
                            context.report({
                                node: specifier,
                                messageId: "prefer-source",
                                data: {
                                    name: specifier.imported.name,
                                    source: correctSource,
                                },
                                fix(fixer) {
                                    const sourceCode = getSourceCode(context);
                                    const program = sourceCode.ast;
                                    const correctDeclaration =
                                        program.body.find(
                                            (node) =>
                                                node.type ===
                                                    "ImportDeclaration" &&
                                                node.source.value ===
                                                    correctSource,
                                        );
                                    if (correctDeclaration) {
                                        return [
                                            removeSpecifier(
                                                fixer,
                                                sourceCode,
                                                specifier,
                                            ),
                                            appendImports(
                                                fixer,
                                                sourceCode,
                                                correctDeclaration,
                                                [sourceCode.getText(specifier)],
                                            ),
                                        ].filter(Boolean);
                                    }
                                    const firstSolidDeclaration =
                                        program.body.find(
                                            (node) =>
                                                node.type ===
                                                    "ImportDeclaration" &&
                                                isSource(node.source.value),
                                        );
                                    return [
                                        removeSpecifier(
                                            fixer,
                                            sourceCode,
                                            specifier,
                                        ),
                                        insertImports(
                                            fixer,
                                            sourceCode,
                                            correctSource,
                                            [sourceCode.getText(specifier)],
                                            firstSolidDeclaration,
                                            isType,
                                        ),
                                    ];
                                },
                            });
                        }
                    }
                }
            },
        };
    },
});
