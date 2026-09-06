import { throwsDeliberately } from "./deliberate_throw.js";
import { getTypeBuddyImportInsertion } from "./typebuddy_import.js";

type AstNode = {
    type: string;
    body?: AstNode | AstNode[];
    async?: boolean;
    parent?: AstNode;
    range?: [number, number];
    [key: string]: unknown;
};

type RuleContext = {
    getSourceCode(): { getText(node: unknown): string };
    report(descriptor: {
        node: unknown;
        messageId: string;
        fix(fixer: {
            replaceText(node: unknown, text: string): unknown;
            insertTextBeforeRange(
                range: [number, number],
                text: string,
            ): unknown;
        }): unknown;
    }): void;
};

type RuleFixer = {
    replaceText(node: unknown, text: string): unknown;
    insertTextBeforeRange(range: [number, number], text: string): unknown;
};

function hasTryCatch(nodes: AstNode[]): boolean {
    return nodes.some((node) => {
        return node.type === "TryStatement";
    });
}

function isCallArgumentCallback(node: AstNode): boolean {
    const parent = node.parent;
    if (!parent) {
        return false;
    }

    if (parent.type !== "CallExpression" && parent.type !== "NewExpression") {
        return false;
    }

    return (
        Array.isArray(parent["arguments"]) && parent["arguments"].includes(node)
    );
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();
        let scheduledErrImport = false;

        function ensureErrImportFixes(
            node: AstNode,
            fixer: RuleFixer,
        ): unknown[] {
            if (scheduledErrImport) {
                return [];
            }

            const insertion = getTypeBuddyImportInsertion(node, "err");
            if (!insertion) {
                return [];
            }

            scheduledErrImport = true;

            return [
                fixer.insertTextBeforeRange(insertion.range, insertion.text),
            ];
        }

        // Two zero-width insertions leave the body's own text untouched, byte
        // for byte. Rebuilding it statement by statement used to strip leading
        // whitespace on every line — including lines inside template literals,
        // which silently changed string values.
        function wrapBlockFixes(
            bodyNode: AstNode,
            fixer: RuleFixer,
        ): unknown[] | null {
            const range = bodyNode.range;
            if (!Array.isArray(range) || range.length < 2) {
                return null;
            }

            return [
                fixer.insertTextBeforeRange(
                    [range[0] + 1, range[0] + 1],
                    "\ntry {",
                ),
                fixer.insertTextBeforeRange(
                    [range[1] - 1, range[1] - 1],
                    "} catch {\nreturn err();\n}\n",
                ),
            ];
        }

        /**
         * Wrap an expression-bodied arrow's value in a block with try/catch.
         *
         * The body node's range stops inside any wrapping parentheses, so
         * replacing it in `async () => ({ a: 1 })` would leave the parentheses
         * around a block and produce `({ try { ... } })`. Walking left over
         * those parentheses first, then inserting on either side, keeps the
         * expression itself untouched — parentheses and all.
         */
        function wrapExpressionBodyFixes(
            node: AstNode,
            bodyNode: AstNode,
            fixer: RuleFixer,
        ): unknown[] | null {
            const arrowRange = node.range;
            const bodyRange = bodyNode.range;
            if (
                !Array.isArray(arrowRange) ||
                arrowRange.length < 2 ||
                !Array.isArray(bodyRange) ||
                bodyRange.length < 2
            ) {
                return null;
            }

            let prefix = sourceCode
                .getText(node)
                .slice(0, bodyRange[0] - arrowRange[0]);
            while (prefix.trimEnd().endsWith("(")) {
                prefix = prefix.trimEnd().slice(0, -1);
            }

            const start = arrowRange[0] + prefix.length;
            // The arrow's own end already sits past any closing parenthesis.
            const end = arrowRange[1];
            if (start >= end) {
                return null;
            }

            return [
                fixer.insertTextBeforeRange(
                    [start, start],
                    "{\ntry {\nreturn ",
                ),
                fixer.insertTextBeforeRange(
                    [end, end],
                    ";\n} catch {\nreturn err();\n}\n}",
                ),
            ];
        }

        function checkFunction(node: AstNode) {
            if (node.async !== true) return;
            if (isCallArgumentCallback(node)) return;
            const bodyNode = node.body;
            if (!bodyNode || Array.isArray(bodyNode)) return;

            // A function that throws has already decided its failure is not a
            // value. Wrapping it in try/catch would swallow that decision.
            if (throwsDeliberately(bodyNode)) return;

            // An expression-bodied arrow (`async () => fetch(url)`) returns the
            // one value the try/catch exists to guard, so it needs a block
            // before it can get one.
            if (bodyNode.type !== "BlockStatement") {
                context.report({
                    node,
                    messageId: "missingTryCatch",
                    fix(fixer) {
                        const wrapFixes = wrapExpressionBodyFixes(
                            node,
                            bodyNode,
                            fixer,
                        );
                        if (!wrapFixes) {
                            return null;
                        }

                        return [
                            ...ensureErrImportFixes(node, fixer),
                            ...wrapFixes,
                        ];
                    },
                });
                return;
            }

            const body = Array.isArray(bodyNode.body) ? bodyNode.body : [];
            if (hasTryCatch(body)) return;

            context.report({
                node,
                messageId: "missingTryCatch",
                fix(fixer) {
                    const wrapFixes = wrapBlockFixes(bodyNode, fixer);
                    if (!wrapFixes) {
                        return null;
                    }

                    return [...ensureErrImportFixes(node, fixer), ...wrapFixes];
                },
            });
        }

        return {
            FunctionDeclaration: checkFunction,
            FunctionExpression: checkFunction,
            ArrowFunctionExpression: checkFunction,
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Async functions should have a try-catch block returning an error result.",
        },
        fixable: "code",
        schema: [],
        messages: {
            missingTryCatch:
                "Async functions must have a try-catch block returning an error result.",
        },
    },
};

export { rule as requireTryCatchAsyncRule };
