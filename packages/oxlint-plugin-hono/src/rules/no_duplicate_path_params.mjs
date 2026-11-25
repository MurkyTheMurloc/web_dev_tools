import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    createHonoTracker,
    extractPathParams,
    joinPaths
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow declaring the same `:param` name more than once in a Hono route path.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            duplicatePathParam:
                'Route path `{{path}}` defines parameter `:{{param}}` more than once, so the later segment silently overwrites the earlier value in `c.req.param("{{param}}")`. Fix: give each path parameter a distinct name (for example `:{{param}}` and `:{{suggestion}}`). Do not: read the raw URL manually to work around the collision or disable the rule.'
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);

        function checkPath(fullPath, reportNode) {
            const params = extractPathParams(fullPath);
            const seen = new Set();
            const reported = new Set();

            for (const { name } of params) {
                if (seen.has(name) && !reported.has(name)) {
                    reported.add(name);
                    context.report({
                        data: {
                            param: name,
                            path: fullPath,
                            suggestion: `${name}2`
                        },
                        messageId: "duplicatePathParam",
                        node: reportNode
                    });
                }
                seen.add(name);
            }
        }

        return {
            ArrowFunctionExpression: tracker.handleFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info) {
                    return;
                }
                if (
                    info.kind !== "route" &&
                    info.kind !== "use" &&
                    info.kind !== "basePath" &&
                    info.kind !== "subapp"
                ) {
                    return;
                }

                for (let index = 0; index < info.paths.length; index += 1) {
                    const segment = info.paths[index];
                    if (segment === null) {
                        continue;
                    }
                    const fullPath =
                        info.app.basePath && info.app.basePath.length > 0
                            ? joinPaths(info.app.basePath, segment)
                            : segment;
                    checkPath(fullPath, info.pathNodes[index] ?? node);
                }
            },
            FunctionDeclaration: tracker.handleFunction,
            FunctionExpression: tracker.handleFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
