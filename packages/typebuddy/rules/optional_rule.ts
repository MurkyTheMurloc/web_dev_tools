import { createImportPlanner } from "./typebuddy_import.js";

type RuleFixer = {
    replaceText(node: unknown, text: string): unknown;
    insertTextBeforeRange(range: [number, number], text: string): unknown;
};

const rule = {
    create(context: {
        getSourceCode(): {
            getText(node: unknown): string;
            getScope(node: unknown): unknown;
        };
        report(descriptor: {
            node: unknown;
            messageId: string;
            data: { type: string; union: string };
            fix(fixer: RuleFixer): unknown;
        }): void;
    }) {
        const sourceCode = context.getSourceCode();
        const imports = createImportPlanner(sourceCode);

        return {
            TSUnionType(node: { types: Array<{ type: string }> }) {
                if (node.types.length !== 2) return;

                const undefinedType = node.types.find(
                    (typeNode) => typeNode.type === "TSUndefinedKeyword"
                );
                // `null | undefined` has no non-nullish member to name, and
                // rewriting it to `Optional<null>` only restated it with more
                // syntax.
                const otherType = node.types.find(
                    (typeNode) =>
                        typeNode.type !== "TSUndefinedKeyword" &&
                        typeNode.type !== "TSNullKeyword"
                );

                if (undefinedType && otherType) {
                    const typeText = sourceCode.getText(otherType);

                    context.report({
                        node,
                        messageId: "preferOptional",
                        data: {
                            type: typeText,
                            union: sourceCode.getText(node)
                        },
                        fix(fixer) {
                            // See `prefer-maybe`: the fix only uses the
                            // package's own `Optional`, imported where it is
                            // not already.
                            const importFixes = imports.fixes(
                                node,
                                fixer,
                                "Optional",
                                "type"
                            );
                            if (importFixes === null) return null;

                            return [
                                ...importFixes,
                                fixer.replaceText(node, `Optional<${typeText}>`)
                            ];
                        }
                    });
                }
            }
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce using Optional<T> instead of T | undefined"
        },
        fixable: "code",
        schema: [],
        messages: {
            preferOptional:
                '`{{union}}` is the type typebuddy names `Optional<{{type}}>`. Both mean the same, and one spelling keeps `T | undefined` recognisable as the thing `isOptional` narrows. Fix: `Optional<{{type}}>` with `import type { Optional } from "@murky-web/typebuddy";` (`--fix` applies it where `Optional` is not already another binding).'
        }
    }
};

export { rule as optionalRule };
