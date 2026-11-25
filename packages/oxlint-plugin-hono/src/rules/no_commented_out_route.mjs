import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import { createHonoTracker } from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

const ROUTE_METHOD_PATTERN =
    "(?:get|post|put|patch|delete|options|all|on|use|route)";

const DEFAULT_APP_NAMES = new Set(["app", "hono", "router", "api"]);

// Matches a standalone commented-out route line such as `app.get("/old", ...)`
// without matching prose sentences like `// calls app.get("/x") internally`.
const COMMENTED_ROUTE_LINE = new RegExp(
    String.raw`^\s*(?:\*\s*)?(?:export\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\.(${ROUTE_METHOD_PATTERN})\s*\(`,
    "u"
);

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Disallow commented-out Hono route and middleware registrations.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            commentedOutRoute:
                "Commented-out Hono route `{{snippet}}` leaves dead routing code in the file and misleads readers about active endpoints. Fix: delete the commented-out route (git history keeps it) or re-enable it if the endpoint is still needed. Do not: leave routes commented out or disable the rule."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);

        return {
            ArrowFunctionExpression: tracker.handleFunction,
            FunctionDeclaration: tracker.handleFunction,
            FunctionExpression: tracker.handleFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            "Program:exit"() {
                if (!tracker.hasHonoImport()) {
                    return;
                }

                const trackedNames = tracker.getTrackedAppNames();
                const allowedNames = new Set([
                    ...DEFAULT_APP_NAMES,
                    ...trackedNames
                ]);
                const comments = sourceCode.getAllComments?.() ?? [];

                for (const comment of comments) {
                    // Skip JSDoc blocks (`/** ... */`) so `@example` docs stay allowed.
                    if (
                        comment.type === "Block" &&
                        comment.value.startsWith("*")
                    ) {
                        continue;
                    }

                    const lines = comment.value.split(/\r?\n/u);
                    for (const line of lines) {
                        const match = COMMENTED_ROUTE_LINE.exec(line);
                        if (!match) {
                            continue;
                        }
                        const [, receiverName, methodName] = match;
                        if (!allowedNames.has(receiverName)) {
                            continue;
                        }

                        context.report({
                            data: {
                                snippet: `${receiverName}.${methodName}(...)`
                            },
                            loc: comment.loc,
                            messageId: "commentedOutRoute"
                        });
                        break;
                    }
                }
            },
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
