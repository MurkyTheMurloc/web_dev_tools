/**
 * Result values for MaybePromise-style flows. Deliberately free of dependencies
 * on the guards — a caller that only needs `ok`/`err` should not pull a
 * type-guard module along with it.
 */

import type { Failed, Result, Success } from "./types/maybe_promise.js";

/**
 * Checks if the provided result is a `Success` type.
 *
 * @example
 *     ```typescript
 *     const result = await someAsyncFunction();
 *     if (isSuccess(result)) {
 *         return result.value; // TypeScript knows `value` is of type `T`
 *     }
 *     ```
 *
 * @template R The result type passed in. The guard narrows it by its `isError`
 *   flag, so `value` keeps the success type without an extra `| null`.
 * @param {R} result The result to check, which can be either a `Success<T>`
 *   or `Failed`.
 * @returns {boolean} `true` if the result is a `Success<T>`, `false` if it is a
 *   `Failed`. This function acts as a type guard, narrowing `result` to its
 *   `Success` member when the condition is met.
 */
function isSuccess<R extends Readonly<Result<unknown>>>(
    result: R,
): result is Extract<R, { isError: false }> {
    return !result.isError;
}

/** Creates a successful result object for MaybePromise-style flows. */
function ok(): Success<void>;
function ok<T>(value: T): Success<T>;
// oxlint-disable-next-line typescript-eslint/prefer-readonly-parameter-types -- ok() intentionally accepts arbitrary payload values, including mutable ones.
function ok<T>(...args: readonly [T] | []): Success<T | void> {
    const [value] = args;
    return {
        isError: false,
        value,
    };
}

/** Creates the default failed result object for MaybePromise-style flows. */
function err(): Failed;
function err<T extends null>(value: T): Failed<T>;
// oxlint-disable-next-line typescript-eslint/prefer-readonly-parameter-types -- err() mirrors ok() and accepts the caller's payload shape without forcing readonly wrappers.
function err<T extends null>(...args: readonly [T] | []): Failed {
    const [value] = args;
    return {
        isError: true,
        value: value ?? null,
    };
}

export { err, isSuccess, ok };
