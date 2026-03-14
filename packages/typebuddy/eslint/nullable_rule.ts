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
  create(context) {
    return {
      TSUnionType(node) {
        const types = node.types;
        if (types.length !== 3) return; // nur T | null | undefined prüfen

        const sourceCode = context.getSourceCode();
        const nullType = types.find((t) => t.type === "TSNullKeyword");
        const undefinedType = types.find(
          (t) => t.type === "TSUndefinedKeyword"
        );
        const otherType = types.find(
          (t) => t.type !== "TSNullKeyword" && t.type !== "TSUndefinedKeyword"
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
