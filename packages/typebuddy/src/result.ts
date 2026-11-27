/**
 * Result values and boundary helpers for `Result` / `AsyncResult` flows.
 * Deliberately free of runtime dependencies — a caller that only needs
 * `ok`/`err` or `fromPromise` pulls in nothing else.
 */

import type {
    AsyncResult,
    Failed,
    Result,
    Success,
    TaggedError
} from "./types/maybe_promise.js";

type ResultValues<T extends readonly Readonly<Result<unknown, unknown>>[]> = {
    -readonly [K in keyof T]: T[K] extends Readonly<Result<infer V, unknown>>
        ? V
        : never;
};

type ResultErrors<T extends readonly Readonly<Result<unknown, unknown>>[]> =
    T[number] extends Readonly<Result<unknown, infer E>> ? E : never;

/**
 * Checks if the provided result is a `Success` type.
 *
 * @example
 *     ```typescript
 *     const result = await someAsyncFunction();
 *     if (isSuccess(result)) {
 *     return result.value; // TypeScript knows `value` is of type `T`
 *     }
 *     ```
 *
 * @template R The result type passed in. The guard narrows it by its `isError`
 *   flag, so `value` keeps the success type without an extra `| null`. A
 *   `Result<T | null>`, a generic `Result<T>` and a `Result<any>` all work.
 * @param {R} result The result to check, which can be either a `Success<T>` or
 *   `Failed<E>`.
 * @returns {boolean} `true` if the result is a `Success<T>`, `false` if it is a
 *   `Failed<E>`. This function acts as a type guard, narrowing `result` to its
 *   `Success` member when the condition is met.
 */
function isSuccess<R extends Readonly<Result<unknown, unknown>>>(
    result: R
): result is Extract<R, { isError: false }> {
    return !result.isError;
}

/**
 * Checks if the provided result is a `Failed` type.
 *
 * @template R The result type passed in.
 * @param {R} result The result to check.
 * @returns {boolean} `true` when `result` is a `Failed<E>`, narrowing `result`
 *   to its failure member.
 */
function isErr<R extends Readonly<Result<unknown, unknown>>>(
    result: R
): result is Extract<R, { isError: true }> {
    return result.isError;
}

/**
 * Creates a successful result object for Result-style flows.
 *
 * @returns {Success<void>} A void success result.
 */
function ok(): Success<void>;
function ok<T>(value: T): Success<T>;
function ok<T>(...args: readonly [T] | []): Success<T | void> {
    const [value] = args;
    return {
        isError: false,
        value
    };
}

/**
 * Creates a failed result object. Without an argument it carries `null`; with
 * an argument it carries a typed error payload `E`.
 *
 * @returns {Failed} A failed result holding `null` or the given error payload.
 */
function err(): Failed;
function err<E>(value: E): Failed<E>;
function err<E>(...args: readonly [E] | []): Failed<E | null> {
    if (args.length === 0) {
        return {
            isError: true,
            value: null
        };
    }

    const [value] = args;
    return {
        isError: true,
        value
    };
}

/**
 * Builds a discriminated error object with a readonly `_tag` literal, ready for
 * exhaustive `switch (result.value._tag)` checks.
 *
 * @param {Tag} tag - Discriminant literal naming the error kind.
 * @returns {TaggedError<Tag>} A tagged error object.
 */
function taggedError<Tag extends string>(tag: Tag): TaggedError<Tag>;
function taggedError<
    Tag extends string,
    const Fields extends Readonly<Record<string, unknown>>
>(tag: Tag, fields: Fields): TaggedError<Tag, Fields>;
function taggedError<
    Tag extends string,
    const Fields extends Readonly<Record<string, unknown>>
>(
    tag: Tag,
    fields?: Fields
): { readonly _tag: Tag } | ({ readonly _tag: Tag } & Readonly<Fields>) {
    if (fields === undefined) {
        return { _tag: tag };
    }

    return {
        ...fields,
        _tag: tag
    };
}

/**
 * Exhaustiveness guard for `switch` / `if` chains over discriminated unions.
 * Fails compilation whenever a union member is not handled, and throws loudly
 * at runtime if an impossible value slips past the boundary.
 *
 * @param {never} value - The value that must be unreachable.
 * @param {string} [message] - Optional context for the thrown error.
 * @returns {never} Never returns.
 */
function assertNever(value: never, message?: string): never {
    const detail = message ?? `Unexpected value: ${String(value)}`;
    throw new Error(detail);
}

/**
 * Runs a synchronous boundary call that may throw and maps any thrown value
 * into a typed `Failed<E>` instead of letting exceptions escape or swallowing
 * their cause.
 *
 * @param {() => T} fn - The operation to execute.
 * @param {(cause: unknown) => E} onError - Converts a thrown value into `E`.
 * @returns {Result<T, E>} `Success<T>` or `Failed<E>`.
 */
function fromTry<T, E>(
    fn: () => T,
    onError: (cause: unknown) => E
): Result<T, E> {
    try {
        return ok(fn());
    } catch (error: unknown) {
        return err(onError(error));
    }
}

/**
 * Awaits a promise-like boundary call and maps any rejection into a typed
 * `Failed<E>`.
 *
 * @param {PromiseLike<T>} promise - The promise to settle.
 * @param {(cause: unknown) => E} onError - Converts a rejection reason into
 *   `E`.
 * @returns {AsyncResult<T, E>} Resolves to `Success<T>` or `Failed<E>`.
 */
async function fromPromise<T, E>(
    promise: PromiseLike<T>,
    onError: (cause: unknown) => E
): AsyncResult<T, E> {
    try {
        return ok(await promise);
    } catch (error: unknown) {
        return err(onError(error));
    }
}

/**
 * Returns the success value or a caller-supplied fallback on failure.
 *
 * @param {Readonly<Result<T, E>>} result - The result to unwrap.
 * @param {T} fallback - Value returned when `result` failed.
 * @returns {T} The unwrapped value or `fallback`.
 */
function unwrapOr<T, E>(result: Readonly<Result<T, E>>, fallback: T): T {
    if (isSuccess(result)) {
        return result.value;
    }

    return fallback;
}

/**
 * Transforms the value of a `Success<T>` while leaving a `Failed<E>` untouched.
 *
 * @param {Readonly<Result<T, E>>} result - The result to transform.
 * @param {(value: T) => U} fn - Mapper applied to the success value.
 * @returns {Result<U, E>} The mapped result.
 */
function mapResult<T, U, E>(
    result: Readonly<Result<T, E>>,
    fn: (value: T) => U
): Result<U, E> {
    if (isSuccess(result)) {
        return ok(fn(result.value));
    }

    return err(result.value);
}

/**
 * Transforms the error payload of a `Failed<E>` while leaving a `Success<T>`
 * untouched.
 *
 * @param {Readonly<Result<T, E>>} result - The result to transform.
 * @param {(error: E) => F} fn - Mapper applied to the error payload.
 * @returns {Result<T, F>} The mapped result.
 */
function mapError<T, E, F>(
    result: Readonly<Result<T, E>>,
    fn: (error: E) => F
): Result<T, F> {
    if (isSuccess(result)) {
        return ok(result.value);
    }

    return err(fn(result.value));
}

/**
 * Combines a tuple or array of results fail-fast: returns `Success` with all
 * unwrapped values in order, or the first `Failed` encountered.
 *
 * @param {T} results - The results to combine.
 * @returns {Result<ResultValues<T>, ResultErrors<T>>} Combined result.
 */
function allResults<
    const T extends readonly Readonly<Result<unknown, unknown>>[]
>(results: T): Result<ResultValues<T>, ResultErrors<T>>;
function allResults(
    results: readonly Readonly<Result<unknown, unknown>>[]
): Result<unknown[], unknown>;
function allResults(
    results: readonly Readonly<Result<unknown, unknown>>[]
): Result<unknown[], unknown> {
    const values: unknown[] = [];

    for (const entry of results) {
        if (entry.isError) {
            return err(entry.value);
        }
        values.push(entry.value);
    }

    return ok(values);
}

export {
    allResults,
    assertNever,
    err,
    fromPromise,
    fromTry,
    isErr,
    isSuccess,
    mapError,
    mapResult,
    ok,
    taggedError,
    unwrapOr
};
