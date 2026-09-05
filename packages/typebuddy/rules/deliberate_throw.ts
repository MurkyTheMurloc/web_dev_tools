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
 * Whether a function body throws on purpose.
 *
 * A `throw` in a function's own body is the author saying this failure is not a
 * value to hand back. A missing manifest for a route the app is navigating to,
 * an unreachable branch, a broken invariant — those should be loud. Turning them
 * into `err()` converts a bug into a silently handled outcome, and the caller
 * degrades politely instead of surfacing that something is wrong.
 *
 * So both async rules leave such a function alone. The rules exist to push
 * *recoverable* failures into the return type, not to abolish throwing.
 *
 * Two boundaries matter. A throw inside a nested function belongs to that
 * function, so the walk does not descend into one. A throw inside `catch` still
 * counts: a rethrow is as deliberate as an original throw, and it is how code
 * says "this one is not mine to handle".
 *
 * @param {unknown} body - The function body node to inspect.
 * @returns {boolean} True when the body throws outside any nested function.
 */
function throwsDeliberately(body: unknown): boolean {
  if (!isNode(body)) {
    return false;
  }

  const pending: AstNode[] = [body];
  while (pending.length > 0) {
    // `pop` on a non-empty array always yields a node; the length check above is
    // the loop condition, but `noUncheckedIndexedAccess` cannot see that.
    const current = pending.pop();
    if (current === undefined) {
      break;
    }

    if (current.type === "ThrowStatement") {
      return true;
    }

    for (const [key, value] of Object.entries(current)) {
      // `parent` points back up the tree; following it would never terminate.
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

  return false;
}

export { throwsDeliberately };
