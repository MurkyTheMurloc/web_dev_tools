import {
  ESLintUtils,
  TSESTree,
  AST_NODE_TYPES,
} from "@typescript-eslint/utils";

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Async functions should have a try-catch block returning FAILED_PROMISE.",
    },
    fixable: "code",
    schema: [],
    messages: {
      missingTryCatch:
        "Async functions must have a try-catch block returning FAILED_PROMISE.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.getSourceCode();

    function hasTryCatch(nodes: TSESTree.Statement[]): boolean {
      return nodes.some((n) => n.type === AST_NODE_TYPES.TryStatement);
    }

    function getIndentation(node: TSESTree.Node): string {
      const lines = sourceCode.getText(node).split("\n");
      const firstLine = lines[0];
      const match = firstLine.match(/^\s*/);
      return match ? match[0] : "";
    }

    function wrapInTryCatch(node: TSESTree.BlockStatement): string {
      const indent = getIndentation(node);
      const innerIndent = indent + "  "; // Add two spaces for nested block
      const bodyText = node.body
        .map((n) => {
          const text = sourceCode.getText(n);
          // Re-indent each statement to align with try block
          return innerIndent + text.replace(/^\s*/gm, "");
        })
        .join("\n");

      return `{
${indent}try {
${bodyText}
${indent}} catch (err) {
${innerIndent}return FAILED_PROMISE;
${indent}}
}`;
    }

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (
        !node.async ||
        !node.body ||
        node.body.type !== AST_NODE_TYPES.BlockStatement
      ) {
        return;
      }

      if (!hasTryCatch(node.body.body)) {
        context.report({
          node,
          messageId: "missingTryCatch",
          fix(fixer) {
            return fixer.replaceText(node.body, wrapInTryCatch(node.body));
          },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

export { rule as requireTryCatchAsyncRule };
