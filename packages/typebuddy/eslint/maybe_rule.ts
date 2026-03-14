const rule = {
  meta: {
    type: "suggestion",
    hasSuggestions: true,

    docs: {
      description:
        "Use Maybe<T> for T | null and Nullable<T> for T | null | undefined",
    },

    fixable: "code",
    schema: [],
    messages: {
      useMaybe: "Use Maybe<{{type}}> instead of {{type}} | null",
      useNullable:
        "Use Nullable<{{type}}> instead of {{type}} | null | undefined",
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
          // T | null -> Maybe<T>
          const typeText = sourceCode.getText(otherTypes[0]);
          context.report({
            node,
            messageId: "useMaybe",
            data: { type: typeText },
            fix(fixer) {
              return fixer.replaceText(node, `Maybe<${typeText}>`);
            },
          });
        } else if (nullType && undefinedType && otherTypes.length === 1) {
          // T | null | undefined -> Nullable<T>
          const typeText = sourceCode.getText(otherTypes[0]);
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

export { rule as maybeRule };
