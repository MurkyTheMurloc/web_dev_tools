type AstNode = {
  type: string;
  [key: string]: unknown;
};

const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && "type" in value;
}

/**
 * Visit every node that belongs to `root`, stopping at nested functions.
 *
 * Both async rules need the same notion of "this function's own code". A
 * `throw` or a `return` inside a nested function belongs to that function, not
 * to the one being linted, so the walk never descends into one — and `parent`
 * points back up the tree, so following it would not terminate.
 *
 * `visit` may return `false` to keep the walk out of a node's children. That is
 * how a rule declines a subtree that some other visitor already owns.
 *
 * @param {unknown} root - The node to start from. Visited itself, and never
 *   skipped for being a function.
 * @param {(node: AstNode) => boolean | void} visit - Called once per node.
 *   Return `false` to skip that node's children.
 * @returns {void}
 */
function walkOwnSubtree(
  root: unknown,
  visit: (node: AstNode) => boolean | void,
): void {
  if (!isNode(root)) {
    return;
  }

  const pending: AstNode[] = [root];
  while (pending.length > 0) {
    // `pop` on a non-empty array always yields a node; the length check above
    // is the loop condition, but `noUncheckedIndexedAccess` cannot see that.
    const current = pending.pop();
    if (current === undefined) {
      break;
    }

    if (visit(current) === false) {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === "parent") {
        continue;
      }

      const candidates = Array.isArray(value) ? value : [value];
      for (const candidate of candidates) {
        if (!isNode(candidate) || FUNCTION_TYPES.has(candidate.type)) {
          continue;
        }
        pending.push(candidate);
      }
    }
  }
}

export { walkOwnSubtree };
