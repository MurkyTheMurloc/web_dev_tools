import {
    isGlobalReference,
    sourceCodeOf
} from "@murky-web/oxlint-plugin/utils";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow `process.env` in edge-targeted Hono apps in favor of `c.env` or `env(c)` from `hono/adapter`.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            noProcessEnv:
                "`process.env` is unavailable or empty on edge runtimes (Cloudflare Workers, Deno Deploy, Fastly) and breaks runtime portability in Hono apps. Fix: read bindings via `c.env` inside handlers or `env(c)` from `hono/adapter` for cross-runtime code. Do not: polyfill `process.env` or disable the rule."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);

        return {
            MemberExpression(node) {
                if (
                    node.object.type !== "Identifier" ||
                    node.object.name !== "process"
                ) {
                    return;
                }

                const isEnvProperty =
                    (!node.computed &&
                        node.property.type === "Identifier" &&
                        node.property.name === "env") ||
                    (node.computed &&
                        node.property.type === "Literal" &&
                        node.property.value === "env");

                if (!isEnvProperty) {
                    return;
                }

                if (!isGlobalReference(sourceCode, node.object)) {
                    return;
                }

                context.report({
                    messageId: "noProcessEnv",
                    node
                });
            }
        };
    }
};
