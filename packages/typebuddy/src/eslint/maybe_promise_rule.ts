import { TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Ensure async functions' return values follow the MaybePromise pattern.",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceWithMaybePromise:
        "Use 'MaybePromise' instead of 'Promise' as the return type in async functions.",
      wrapReturn: "Wrap return value with { value: value, isError: false }.",
      returnVoidPromise:
        "Return VOID_PROMISE for async functions with Promise<void> return type.",
      returnFailedPromise:
        "Return FAILED_PROMISE in catch block of async functions.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.getSourceCode();

    function isAsyncFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSFunctionType
        | TSESTree.TSMethodSignature,
    ): boolean {
      return node.async === true;
    }

    function isPromiseVoid(node: TSESTree.TSTypeReference): boolean {
      return (
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        node.typeName.name === "Promise" &&
        node.typeArguments?.params[0]?.type === AST_NODE_TYPES.TSVoidKeyword
      );
    }

    function getPromiseTypeArgument(
      node: TSESTree.TSTypeReference,
    ): TSESTree.TSType | null {
      if (
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        node.typeName.name === "Promise" &&
        node.typeArguments?.params[0]
      ) {
        return node.typeArguments.params[0];
      }
      return null;
    }

    function checkReturnType(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSFunctionType
        | TSESTree.TSMethodSignature,
    ) {
      if (!isAsyncFunction(node)) return;

      if (
        node.returnType?.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference
      ) {
        const typeNode = node.returnType.typeAnnotation;
        const typeName = typeNode.typeName;
        if (
          typeName.type === AST_NODE_TYPES.Identifier &&
          typeName.name === "Promise"
        ) {
          context.report({
            node: typeName,
            messageId: "replaceWithMaybePromise",
            fix(fixer) {
              return fixer.replaceText(typeName, "MaybePromise");
            },
          });
        }
      }
    }

    function wrapReturnValue(
      node: TSESTree.ReturnStatement,
      isAsync: boolean,
      returnType: TSESTree.TSType | null,
    ) {
      if (!isAsync) return;

      if (!node.argument) {
        // Handle void returns
        if (returnType && returnType.type === AST_NODE_TYPES.TSVoidKeyword) {
          context.report({
            node,
            messageId: "returnVoidPromise",
            fix(fixer) {
              return fixer.replaceText(node, "return VOID_PROMISE");
            },
          });
        }
        return;
      }

      const arg = node.argument;

      // Allow global constants
      if (
        arg.type === AST_NODE_TYPES.Identifier &&
        (arg.name === "VOID_PROMISE" || arg.name === "FAILED_PROMISE")
      ) {
        return;
      }

      // Check if return value needs wrapping
      if (
        arg.type !== AST_NODE_TYPES.ObjectExpression ||
        !arg.properties.some(
          (prop) =>
            prop.type === AST_NODE_TYPES.Property &&
            prop.key.type === AST_NODE_TYPES.Identifier &&
            prop.key.name === "isError",
        )
      ) {
        context.report({
          node: arg,
          messageId: "wrapReturn",
          fix(fixer) {
            const argText = sourceCode.getText(arg);
            return fixer.replaceText(
              arg,
              `{ value: ${argText}, isError: false }`,
            );
          },
        });
      }
    }

    function processTryCatch(node: TSESTree.TryStatement) {
      // Check if try-catch is inside an async function
      let parent = node.parent;
      let isAsync = false;
      let parentFunction:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | undefined;
      while (parent) {
        if (
          parent.type === AST_NODE_TYPES.FunctionDeclaration ||
          parent.type === AST_NODE_TYPES.FunctionExpression ||
          parent.type === AST_NODE_TYPES.ArrowFunctionExpression
        ) {
          isAsync = parent.async === true;
          parentFunction = parent;
          break;
        }
        parent = parent.parent;
      }

      if (!isAsync || !parentFunction) return;

      // Get return type for the function
      let returnType: TSESTree.TSType | null = null;
      if (
        parentFunction.returnType?.typeAnnotation?.type ===
        AST_NODE_TYPES.TSTypeReference
      ) {
        returnType = getPromiseTypeArgument(
          parentFunction.returnType.typeAnnotation,
        );
      }

      // Process try block
      node.block.body.forEach((stmt) => {
        if (stmt.type === AST_NODE_TYPES.ReturnStatement) {
          wrapReturnValue(stmt, isAsync, returnType);
        }
      });

      // Process catch block
      if (node.handler) {
        const catchBody = node.handler.body.body;
        const hasCorrectReturn = catchBody.some(
          (stmt) =>
            stmt.type === AST_NODE_TYPES.ReturnStatement &&
            stmt.argument?.type === AST_NODE_TYPES.Identifier &&
            stmt.argument.name === "FAILED_PROMISE",
        );

        if (!hasCorrectReturn) {
          context.report({
            node: node.handler,
            messageId: "returnFailedPromise",
            fix(fixer) {
              const lastStatement = catchBody[catchBody.length - 1];
              if (
                lastStatement?.type === AST_NODE_TYPES.ReturnStatement &&
                lastStatement.argument?.type === AST_NODE_TYPES.ObjectExpression
              ) {
                // Replace existing incorrect return
                return fixer.replaceText(
                  lastStatement,
                  "return FAILED_PROMISE",
                );
              } else {
                // Append FAILED_PROMISE return
                return fixer.insertTextBeforeRange(
                  [
                    node.handler.body.range[1] - 1,
                    node.handler.body.range[1] - 1,
                  ],
                  "return FAILED_PROMISE; ",
                );
              }
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkReturnType,
      FunctionExpression: checkReturnType,
      ArrowFunctionExpression: checkReturnType,
      TSDeclareFunction: checkReturnType,
      TSFunctionType: checkReturnType,
      TSMethodSignature: checkReturnType,
      TryStatement: processTryCatch,
    };
  },
};

export { rule as errorSafeAsyncRule };
