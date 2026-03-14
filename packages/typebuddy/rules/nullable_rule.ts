const rule = {
  meta: {
    type: "suggestion",
    hasSuggestions: true,
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
  defaultOptions: [],
  create(context: {
    getSourceCode(): { getText(node: unknown): string };
    report(descriptor: {
      node: unknown;
      messageId: string;
      data: { type: string };
      fix(fixer: { replaceText(node: unknown, text: string): unknown }): unknown;
    }): void;
  }) {
    return {
      TSUnionType(node: {
        types: Array<{ type: string }>;
      }) {
        const types = node.types;
        if (types.length !== 3) return;

        const sourceCode = context.getSourceCode();
        const nullType = types.find((typeNode) => typeNode.type === "TSNullKeyword");
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
              return fixer.replaceText(node, `Nullable<${typeText}>`);
            },
          });
        }
      },
    };
  },
};

export { rule as nullableRule };
