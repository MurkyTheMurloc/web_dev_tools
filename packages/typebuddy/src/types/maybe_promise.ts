/**
 * A successful outcome. `isError` is always `false`, whatever `value` is: a
 * success may carry `null` (`ok(null)`), and the flag must not flip with the
 * payload.
 */
type Success<T> = {
    isError: false;
    value: T;
};

/**
 * A failed outcome. `isError` is always `true`; `value` defaults to `null` for
 * bare `err()` calls and carries a typed error payload when callers pass one
 * (`err(error)`).
 */
type Failed<E = null> = {
    isError: true;
    value: E;
};

/**
 * A settled outcome: the value, or the failure.
 *
 * This is what an `AsyncResult` (or `MaybePromise`) resolves to, and it needed
 * a name of its own. Without one, anything that holds an already-awaited
 * outcome has to restate the union or reach for `Awaited<...>` to undo a
 * wrapper that is no longer there — which describes the route taken rather than
 * the thing being held.
 */
type Result<T, E = null> = Success<T> | Failed<E>;

type MaybePromise<T, E = null> = Promise<Result<T, E>>;

/**
 * `MaybePromise` under a name that says what it is.
 *
 * Elsewhere in the ecosystem `MaybePromise<T>` almost always means `T |
 * Promise<T>` — a value that may or may not be a promise. Here it means a
 * promise of a `Result`, which is a different thing entirely, so a reader who
 * knows the other convention reads this one wrong. Prefer `AsyncResult` in new
 * code. `MaybePromise` keeps working as an alias.
 */
type AsyncResult<T, E = null> = MaybePromise<T, E>;

/**
 * A discriminated error shape keyed by `_tag`, meant to be combined into error
 * unions on `Result<T, E>` and narrowed exhaustively with `switch` +
 * `assertNever`.
 */
type TaggedError<
    Tag extends string,
    Fields extends Readonly<Record<string, unknown>> | undefined = undefined
> = [Fields] extends [undefined]
    ? { readonly _tag: Tag }
    : { readonly _tag: Tag } & Readonly<Fields>;

export type { AsyncResult, Failed, MaybePromise, Result, Success, TaggedError };
