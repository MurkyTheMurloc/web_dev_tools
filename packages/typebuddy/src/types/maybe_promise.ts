/**
 * A successful outcome. `isError` is always `false`, whatever `value` is: a
 * success may carry `null` (`ok(null)`), and the flag must not flip with the
 * payload.
 */
type Success<T> = {
    isError: false;
    value: T;
};

/** A failed outcome. `isError` is always `true` and `value` is `null`. */
type Failed<T extends null = null> = {
    isError: true;
    value: T;
};

/**
 * A settled outcome: the value, or the failure.
 *
 * This is what a `MaybePromise` resolves to, and it needed a name of its own.
 * Without one, anything that holds an already-awaited outcome has to restate
 * the union or reach for `Awaited<...>` to undo a wrapper that is no longer
 * there — which describes the route taken rather than the thing being held.
 */
type Result<T> = Success<T> | Failed;

type MaybePromise<T> = Promise<Result<T>>;

/**
 * `MaybePromise` under a name that says what it is.
 *
 * Elsewhere in the ecosystem `MaybePromise<T>` almost always means `T |
 * Promise<T>` — a value that may or may not be a promise. Here it means a
 * promise of a `Result`, which is a different thing entirely, so a reader who
 * knows the other convention reads this one wrong. Prefer `AsyncResult` in new
 * code. `MaybePromise` keeps working and is what the `prefer-maybe-promise`
 * rule still suggests.
 */
type AsyncResult<T> = MaybePromise<T>;

export type { AsyncResult, Failed, MaybePromise, Result, Success };
