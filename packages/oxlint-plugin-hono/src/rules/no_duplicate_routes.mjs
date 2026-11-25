import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    areMutuallyExclusive,
    createHonoTracker,
    joinPaths,
    normalizePath
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow registering the same HTTP method and path more than once on the same Hono app instance.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            duplicateRoute:
                '`{{method}} {{path}}` is already registered on this Hono app (line {{firstLine}}), so the second handler is shadowed whenever the earlier route returns a `Response`. Fix: merge the logic into one `{{method}} {{path}}` registration, pass shared middleware via `app.use(...)` or inline handlers (`app.{{lowerMethod}}("{{path}}", mw, handler)`), or change one of the paths. Do not: keep both registrations or disable the rule.'
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);

        // App id -> list of direct route registrations.
        const routesByApp = new Map();
        // Mount calls `{ parentAppId, prefix, subAppId, node }` to expand sub-app routes.
        const mounts = [];

        function recordRoute(appId, entry) {
            let list = routesByApp.get(appId);
            if (!list) {
                list = [];
                routesByApp.set(appId, list);
            }
            list.push(entry);
        }

        function checkRoutes(entries) {
            // key = `${method} ${normalizedPath}` -> array of prior entries.
            const seen = new Map();

            for (const entry of entries) {
                const key = `${entry.method} ${entry.path}`;
                const priorList = seen.get(key);
                if (priorList) {
                    const conflict = priorList.find(
                        (prior) => !areMutuallyExclusive(prior.node, entry.node)
                    );
                    if (conflict) {
                        const firstLine =
                            conflict.reportNode.loc?.start.line ?? 0;
                        context.report({
                            data: {
                                firstLine: String(firstLine),
                                lowerMethod: entry.method.toLowerCase(),
                                method: entry.method,
                                path: entry.path
                            },
                            messageId: "duplicateRoute",
                            node: entry.reportNode
                        });
                        continue;
                    }
                    priorList.push(entry);
                } else {
                    seen.set(key, [entry]);
                }
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
                    info.kind === "subapp" &&
                    info.subApp &&
                    info.paths[0] !== null
                ) {
                    const fullPrefix =
                        info.app.basePath !== null
                            ? joinPaths(info.app.basePath, info.paths[0])
                            : null;
                    if (fullPrefix !== null) {
                        mounts.push({
                            node,
                            parentAppId: info.app.id,
                            prefix: fullPrefix,
                            subAppId: info.subApp.id
                        });
                    }
                    return;
                }

                if (info.kind !== "route" || info.app.basePath === null) {
                    return;
                }

                for (const method of info.methods) {
                    for (let index = 0; index < info.paths.length; index += 1) {
                        const segment = info.paths[index];
                        if (segment === null) {
                            continue;
                        }
                        const fullPath = normalizePath(
                            joinPaths(info.app.basePath, segment)
                        );
                        recordRoute(info.app.id, {
                            method,
                            node,
                            path: fullPath,
                            reportNode: info.pathNodes[index] ?? node
                        });
                    }
                }
            },
            FunctionDeclaration: tracker.handleFunction,
            FunctionExpression: tracker.handleFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            "Program:exit"() {
                // First expand mounted sub-app routes into their parent app so
                // conflicts like `app.route("/api", sub)` + `app.get("/api/x")`
                // are detected accurately.
                const expandedByApp = new Map();
                for (const [appId, list] of routesByApp.entries()) {
                    expandedByApp.set(appId, [...list]);
                }

                for (const mount of mounts) {
                    const subRoutes = routesByApp.get(mount.subAppId);
                    if (!subRoutes || subRoutes.length === 0) {
                        continue;
                    }
                    let parentList = expandedByApp.get(mount.parentAppId);
                    if (!parentList) {
                        parentList = [];
                        expandedByApp.set(mount.parentAppId, parentList);
                    }
                    for (const subEntry of subRoutes) {
                        parentList.push({
                            method: subEntry.method,
                            node: mount.node,
                            path: normalizePath(
                                joinPaths(mount.prefix, subEntry.path)
                            ),
                            reportNode: mount.node
                        });
                    }
                }

                // Sort each app's entries by source order so `firstLine` always
                // points to the earlier registration.
                for (const entries of expandedByApp.values()) {
                    entries.sort(
                        (a, b) =>
                            (a.reportNode.range?.[0] ?? 0) -
                            (b.reportNode.range?.[0] ?? 0)
                    );
                    checkRoutes(entries);
                }
            },
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
