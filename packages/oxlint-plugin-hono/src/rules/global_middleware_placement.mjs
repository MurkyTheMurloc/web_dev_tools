import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import { areMutuallyExclusive, createHonoTracker } from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

/** Formats a concise description of a route call like `app.get("/health", ...)`. */
function describeRoute(appName, info) {
    const firstPath = info.paths[0];
    if (firstPath !== null && firstPath !== undefined) {
        return `${appName}.${info.method}("${firstPath}", ...)`;
    }
    return `${appName}.${info.method}(...)`;
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require global Hono middleware (`app.use(mw)` or `app.use('*', mw)`) to be registered before route handlers on the same app.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            globalMiddlewareAfterRoute:
                'Global middleware `{{call}}` is registered after route `{{route}}` (line {{routeLine}}), so requests matching earlier routes bypass this middleware completely in Hono\'s registration-order router. Fix: move this `use(...)` call above the first route registration on `{{app}}`, or narrow its path (for example `{{app}}.use("/api/*", ...)`) / split public routes into a separate `Hono` instance if skipping earlier routes was intentional. Do not: duplicate the middleware per route or disable the rule.'
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);

        // App id -> ordered list of route/subapp & global-use events.
        const eventsByApp = new Map();

        function recordEvent(appId, event) {
            let list = eventsByApp.get(appId);
            if (!list) {
                list = [];
                eventsByApp.set(appId, list);
            }
            list.push(event);
        }

        return {
            ArrowFunctionExpression: tracker.handleFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info) {
                    return;
                }

                // Only global middleware without a non-root basePath prefix is
                // truly app-wide; `api.basePath("/api").use("*", mw)` is scoped
                // to `/api/*` and may legitimately follow public routes on `app`.
                const hasScopedBasePath =
                    info.app.basePath !== null &&
                    info.app.basePath !== "" &&
                    info.app.basePath !== "/";

                if (
                    info.kind === "use" &&
                    info.isGlobalMiddleware &&
                    !hasScopedBasePath
                ) {
                    recordEvent(info.app.id, {
                        appName: info.app.name,
                        info,
                        kind: "globalUse",
                        node
                    });
                    return;
                }

                if (info.kind === "route" || info.kind === "subapp") {
                    recordEvent(info.app.id, {
                        appName: info.app.name,
                        info,
                        kind: "route",
                        node
                    });
                }
            },
            FunctionDeclaration: tracker.handleFunction,
            FunctionExpression: tracker.handleFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            "Program:exit"() {
                for (const events of eventsByApp.values()) {
                    // For chained calls `app.get("/a", h).use("*", mw)`, the
                    // inner `.get(...)` finishes before the outer `.use(...)`.
                    // Sorting by the method property's start offset preserves
                    // true execution order for both statements and chains.
                    events.sort(
                        (a, b) =>
                            (a.node.callee.property.range?.[0] ?? 0) -
                            (b.node.callee.property.range?.[0] ?? 0)
                    );

                    const seenRoutes = [];
                    for (const event of events) {
                        if (event.kind === "route") {
                            seenRoutes.push(event);
                            continue;
                        }

                        const earlierRoute = seenRoutes.find(
                            (routeEvent) =>
                                !areMutuallyExclusive(
                                    routeEvent.node,
                                    event.node
                                )
                        );
                        if (!earlierRoute) {
                            continue;
                        }

                        const routeLine =
                            earlierRoute.node.callee.property.loc?.start.line ??
                            earlierRoute.node.loc?.start.line ??
                            0;
                        context.report({
                            data: {
                                app: event.appName,
                                call: describeRoute(event.appName, event.info),
                                route: describeRoute(
                                    earlierRoute.appName,
                                    earlierRoute.info
                                ),
                                routeLine: String(routeLine)
                            },
                            messageId: "globalMiddlewareAfterRoute",
                            node: event.node
                        });
                    }
                }
            },
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
