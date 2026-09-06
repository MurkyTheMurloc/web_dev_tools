import { walkOwnSubtree } from "./own_subtree.js";

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
  let found = false;

  walkOwnSubtree(body, (node) => {
    if (node.type === "ThrowStatement") {
      found = true;
    }
  });

  return found;
}

export { throwsDeliberately };
