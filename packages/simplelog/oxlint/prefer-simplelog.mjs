import {
    callWithCallee,
    CONSOLE_METHOD_TO_LOGGER_METHOD,
    loggerNameHint
} from "./utils.mjs";

export const preferSimplelogRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer @murky-web/simplelog over direct console method calls."
        },
        schema: [],
        messages: {
            preferSimplelog:
                '`{{call}}` writes past SimpleLog, so the line skips the logger\'s level threshold, name and log file. Fix: `{{fix}}` on the module\'s logger (`import { Logger } from "@murky-web/simplelog/node"; const logger = new Logger("{{name}}");`, or the `/bun` or `/web` entry), or on `c.var.logger` inside a Hono handler. Do not alias `console` or add `// oxlint-disable` to keep the call.'
        }
    },
    create(context) {
        return {
            CallExpression(node) {
                if (node.callee?.type !== "MemberExpression") {
                    return;
                }

                if (node.callee.computed) {
                    return;
                }

                if (
                    node.callee.object?.type !== "Identifier" ||
                    node.callee.object.name !== "console"
                ) {
                    return;
                }

                if (node.callee.property?.type !== "Identifier") {
                    return;
                }

                const consoleMethod = node.callee.property.name;
                const loggerMethod =
                    CONSOLE_METHOD_TO_LOGGER_METHOD[consoleMethod];

                if (!loggerMethod) {
                    return;
                }

                context.report({
                    messageId: "preferSimplelog",
                    data: {
                        call: callWithCallee(
                            context.sourceCode,
                            node,
                            `console.${consoleMethod}`
                        ),
                        fix: callWithCallee(
                            context.sourceCode,
                            node,
                            `logger.${loggerMethod}`
                        ),
                        name: loggerNameHint(context)
                    },
                    node: node.callee.property
                });
            }
        };
    }
};
