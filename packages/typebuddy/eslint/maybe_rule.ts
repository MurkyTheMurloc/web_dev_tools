const rule = {
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
  defaultOptions: [],
  create(context) {
    return {
      TSUnionType(node) {
        const types = node.types;
        const sourceCode = context.getSourceCode();

        const nullType = types.find((t) => t.type === "TSNullKeyword");
        const undefinedType = types.find(
          (t) => t.type === "TSUndefinedKeyword"
        );
        const otherTypes = types.filter(
          (t) => t.type !== "TSNullKeyword" && t.type !== "TSUndefinedKeyword"
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
};

export { rule as maybeRule };
