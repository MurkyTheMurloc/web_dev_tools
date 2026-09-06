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
        if (node.types.length !== 2) return;

        const undefinedType = node.types.find(
          (typeNode) => typeNode.type === "TSUndefinedKeyword",
        );
        // `null | undefined` has no non-nullish member to name, and rewriting
        // it to `Optional<null>` only restated it with more syntax.
        const otherType = node.types.find(
          (typeNode) =>
            typeNode.type !== "TSUndefinedKeyword" &&
            typeNode.type !== "TSNullKeyword",
        );

        if (undefinedType && otherType) {
          const sourceCode = context.getSourceCode();
          const typeText = sourceCode.getText(otherType);

          context.report({
            node,
            messageId: "preferOptional",
            data: { type: typeText },
            fix(fixer) {
              return fixer.replaceText(node, `Optional<${typeText}>`);
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
      description: "Enforce using Optional<T> instead of T | undefined",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferOptional: "Use Optional<{{type}}> instead of {{type}} | undefined",
    },
  },
};

export { rule as optionalRule };
