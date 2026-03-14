const rule = {
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
  defaultOptions: [],
  create(context) {
    return {
      TSUnionType(node) {
        if (node.types.length !== 2) return;

        const undefinedType = node.types.find(
          (t) => t.type === "TSUndefinedKeyword"
        );
        const otherType = node.types.find(
          (t) => t.type !== "TSUndefinedKeyword"
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
};
export { rule as optionalRule };
