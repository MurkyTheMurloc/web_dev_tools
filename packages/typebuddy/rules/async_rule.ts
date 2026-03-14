type AstNode = {
  type: string;
  body?: AstNode | AstNode[];
  async?: boolean;
  range?: [number, number];
  [key: string]: unknown;
};

type RuleContext = {
  getSourceCode(): { getText(node: unknown): string };
  report(descriptor: {
    node: unknown;
    messageId: string;
    fix(
      fixer: {
        replaceText(node: unknown, text: string): unknown;
      },
    ): unknown;
  }): void;
};

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
  create(context: RuleContext) {
    const sourceCode = context.getSourceCode();

    function getIndentation(node: AstNode): string {
      const lines = sourceCode.getText(node).split("\n");
      const firstLine = lines[0];
      const match = firstLine.match(/^\s*/);
      return match ? match[0] : "";
    }

    function hasTryCatch(nodes: AstNode[]): boolean {
      return nodes.some((node) => node.type === "TryStatement");
    }

    function wrapInTryCatch(node: AstNode): string {
      const body = Array.isArray(node.body) ? node.body : [];
      const indent = getIndentation(node);
      const innerIndent = indent + "  ";
      const bodyText = body
        .map((statement) => {
          const text = sourceCode.getText(statement);
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

    function checkFunction(node: AstNode) {
      if (!node.async) return;
      if (!node.body || Array.isArray(node.body) || node.body.type !== "BlockStatement") {
        return;
      }

      const body = Array.isArray(node.body.body) ? node.body.body : [];
      if (hasTryCatch(body)) return;

      context.report({
        node,
        messageId: "missingTryCatch",
        fix(fixer) {
          return fixer.replaceText(node.body, wrapInTryCatch(node.body as AstNode));
        },
      });
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

export { rule as requireTryCatchAsyncRule };
