import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    createHonoTracker,
    extractPathParams,
    getParamIdentifier,
    getStaticString,
    isFunctionNode,
    joinPaths,
    refersToVariable,
    resolveVariable,
    unwrapExpression
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

function walkOwnBody(node, visit) {
    if (!node || typeof node !== "object") {
        return;
    }
    visit(node);
    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }
        const children = Array.isArray(value) ? value : [value];
        for (const child of children) {
            if (
                child &&
                typeof child === "object" &&
                typeof child.type === "string" &&
                !isFunctionNode(child)
            ) {
                walkOwnBody(child, visit);
            }
        }
    }
}

/**
 * Matches `c.req.param("name")` and returns `{ argNode, paramName }` or null.
 * `c.req.param()` (0 args) and dynamic arguments return null.
 */
function matchReqParamCall(node, sourceCode, contextVar, contextName) {
    if (node.type !== "CallExpression" || node.arguments.length !== 1) {
        return null;
    }
    const callee = unwrapExpression(node.callee);
    if (
        callee?.type !== "MemberExpression" ||
        callee.computed ||
        callee.property.type !== "Identifier" ||
        callee.property.name !== "param"
    ) {
        return null;
    }
    const reqExpr = unwrapExpression(callee.object);
    if (
        reqExpr?.type !== "MemberExpression" ||
        reqExpr.computed ||
        reqExpr.property.type !== "Identifier" ||
        reqExpr.property.name !== "req"
    ) {
        return null;
    }
    const ctxExpr = unwrapExpression(reqExpr.object);
    if (!refersToVariable(sourceCode, ctxExpr, contextVar, contextName)) {
        return null;
    }

    const argNode = node.arguments[0];
    const paramName = getStaticString(argNode);
    if (paramName === null) {
        return null;
    }
    return { argNode, paramName };
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Ensure parameter names passed to `c.req.param(...)` exist in the enclosing Hono route path.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            noParamsInRoute:
                '`{{context}}.req.param("{{param}}")` is called in route `{{path}}`, which defines no path parameters, so it always evaluates to `undefined` at runtime. Fix: add `:{{param}}` to the route path `{{path}}`, or read query/header values with `{{context}}.req.query("{{param}}")` / `{{context}}.req.header(...)` if that was intended. Do not: disable the rule.',
            unknownParam:
                '`{{context}}.req.param("{{param}}")` does not match any parameter in route `{{path}}` (defined: {{defined}}), so it always evaluates to `undefined` at runtime. Fix: pass one of the route\'s defined parameter names ({{defined}}) to `{{context}}.req.param(...)`, or rename the segment in `{{path}}` to `:{{param}}`. Do not: add a fallback default to hide the typo or disable the rule.'
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);
        const pendingRoutes = [];

        return {
            ArrowFunctionExpression: tracker.handleFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info) {
                    return;
                }
                if (
                    info.kind !== "route" ||
                    info.app.basePath === null ||
                    info.handlers.length === 0
                ) {
                    return;
                }
                // Only check routes whose paths are all statically known and
                // contain no `*` wildcard (wildcard routes may match arbitrary
                // sub-segments).
                if (
                    info.paths.length === 0 ||
                    info.paths.some(
                        (path) => path === null || path.includes("*")
                    )
                ) {
                    return;
                }

                const fullPaths = info.paths.map((segment) =>
                    joinPaths(info.app.basePath, segment)
                );

                pendingRoutes.push({
                    appId: info.app.id,
                    fullPaths,
                    handlers: info.handlers
                });
            },
            FunctionDeclaration: tracker.handleFunction,
            FunctionExpression: tracker.handleFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            "Program:exit"() {
                for (const route of pendingRoutes) {
                    const definedParams = new Set();
                    for (const fullPath of route.fullPaths) {
                        for (const param of extractPathParams(fullPath)) {
                            definedParams.add(param.name);
                        }
                    }

                    // Include params inherited from same-file `parent.route("/orgs/:orgId", sub)`.
                    const mountedPrefixes = tracker.getMountedPrefixes(
                        route.appId
                    );
                    let hasWildcardMount = false;
                    for (const prefix of mountedPrefixes) {
                        if (prefix.includes("*")) {
                            hasWildcardMount = true;
                        }
                        for (const param of extractPathParams(prefix)) {
                            definedParams.add(param.name);
                        }
                    }
                    if (hasWildcardMount) {
                        continue;
                    }

                    const displayPath = route.fullPaths.join(" | ");
                    const definedList = [...definedParams]
                        .map((name) => `":${name}"`)
                        .join(", ");

                    for (const handler of route.handlers) {
                        const paramId = getParamIdentifier(handler, 0);
                        if (!paramId) {
                            continue;
                        }
                        const contextVar = resolveVariable(sourceCode, paramId);
                        const contextName = paramId.name;

                        walkOwnBody(handler.body, (node) => {
                            const match = matchReqParamCall(
                                node,
                                sourceCode,
                                contextVar,
                                contextName
                            );
                            if (!match || definedParams.has(match.paramName)) {
                                return;
                            }

                            if (definedParams.size === 0) {
                                context.report({
                                    data: {
                                        context: contextName,
                                        param: match.paramName,
                                        path: displayPath
                                    },
                                    messageId: "noParamsInRoute",
                                    node: match.argNode
                                });
                            } else {
                                context.report({
                                    data: {
                                        context: contextName,
                                        defined: definedList,
                                        param: match.paramName,
                                        path: displayPath
                                    },
                                    messageId: "unknownParam",
                                    node: match.argNode
                                });
                            }
                        });
                    }
                }
            },
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
