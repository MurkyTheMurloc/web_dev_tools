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

                const nullType = types.find(
                    (typeNode) => typeNode.type === "TSNullKeyword",
                );
                const undefinedType = types.find(
                    (typeNode) => typeNode.type === "TSUndefinedKeyword",
                );
                const otherTypes = types.filter(
                    (typeNode) =>
                        typeNode.type !== "TSNullKeyword" &&
                        typeNode.type !== "TSUndefinedKeyword",
                );

                if (nullType && !undefinedType && otherTypes.length === 1) {
                    const typeText = sourceCode.getText(otherTypes[0]);
                    context.report({
                        node,
                        messageId: "useMaybe",
                        data: { type: typeText },
                        fix(fixer) {
                            // `Maybe` has to be the package's type where the
                            // fix puts it: imported, or already imported.
                            // Another library's `Maybe` (or a local one) would
                            // change what the type means, so then there is no
                            // fix.
                            const importFixes = imports.fixes(
                                node,
                                fixer,
                                "Maybe",
                                "type",
                            );
                            if (importFixes === null) return null;

                            return [
                                ...importFixes,
                                fixer.replaceText(node, `Maybe<${typeText}>`),
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
            description: "Use Maybe<T> for T | null",
        },
        fixable: "code",
        schema: [],
        messages: {
            useMaybe: "Use Maybe<{{type}}> instead of {{type}} | null",
        },
    },
};

export { rule as maybeRule };
