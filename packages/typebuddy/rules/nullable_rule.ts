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
            data: { type: string };
            fix(fixer: RuleFixer): unknown;
        }): void;
    }) {
        const sourceCode = context.getSourceCode();
        const imports = createImportPlanner(sourceCode);

        return {
            TSUnionType(node: { types: Array<{ type: string }> }) {
                const types = node.types;
                if (types.length !== 3) return;

                const nullType = types.find(
                    (typeNode) => typeNode.type === "TSNullKeyword",
                );
                const undefinedType = types.find(
                    (typeNode) => typeNode.type === "TSUndefinedKeyword",
                );
                const otherType = types.find(
                    (typeNode) =>
                        typeNode.type !== "TSNullKeyword" &&
                        typeNode.type !== "TSUndefinedKeyword",
                );

                if (nullType && undefinedType && otherType) {
                    const typeText = sourceCode.getText(otherType);
                    context.report({
                        node,
                        messageId: "useNullable",
                        data: { type: typeText },
                        fix(fixer) {
                            // See `prefer-maybe`: the fix only uses the
                            // package's own `Nullable`, imported where it is
                            // not already.
                            const importFixes = imports.fixes(
                                node,
                                fixer,
                                "Nullable",
                                "type",
                            );
                            if (importFixes === null) return null;

                            return [
                                ...importFixes,
                                fixer.replaceText(
                                    node,
                                    `Nullable<${typeText}>`,
                                ),
                            ];
                        },
                    });
                }
            },
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description: "Use Nullable<T> instead of T | null | undefined",
        },
        fixable: "code",
        schema: [],
        messages: {
            useNullable:
                "Use Nullable<{{type}}> instead of {{type}} | null | undefined",
        },
    },
};

export { rule as nullableRule };
