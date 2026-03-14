const rule = {
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
        const sourceCode = context.getSourceCode();

        const nullType = types.find((typeNode) => typeNode.type === "TSNullKeyword");
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
              return fixer.replaceText(node, `Maybe<${typeText}>`);
            },
          });
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    type: "suggestion",
    hasSuggestions: true,
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
