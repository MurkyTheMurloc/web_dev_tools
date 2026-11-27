/**
 * Lightweight I/O resilience helpers (`withTimeout`, `withRetry`) built on
 * standard `AbortSignal` and `AsyncResult`. For resource cleanup prefer native
 * `using` / `await using` (`Symbol.dispose` / `Symbol.asyncDispose`).
 */

import { err, isSuccess, taggedError } from "./result.js";
import type {
    AsyncResult,
    Failed,
    Result,
    Success,
    TaggedError
} from "./types/maybe_promise.js";

/** Error returned by `withTimeout` when the deadline expires first. */
type TimeoutError = TaggedError<"Timeout", { readonly timeoutMs: number }>;

/** Error returned when an external `AbortSignal` aborts the operation. */
type AbortedError = TaggedError<"Aborted", { readonly reason: unknown }>;

/** Options for `withTimeout`. */
type TimeoutOptions = {
    readonly signal?: AbortSignal;
};

/** Options for `withRetry`. */
type RetryOptions<E> = {
    readonly backoffMs?: number | ((attempt: number) => number);
    readonly maxAttempts: number;
    readonly retryIf?: (error: E, attempt: number) => boolean;
    readonly signal?: AbortSignal;
};

type SuccessValue<R> = R extends Readonly<Success<infer T>> ? T : never;
type ErrorValue<R> = R extends Readonly<Failed<infer E>> ? E : never;
type SignalLike = { readonly reason?: unknown };

const ZERO_MS = 0;
const FIRST_ATTEMPT = 1;
const NEXT_ATTEMPT_STEP = 1;

function readAbortReason(signal: SignalLike | undefined): unknown {
    return signal?.reason;
}

function resolveBackoffMs<E>(
    backoffMs: RetryOptions<E>["backoffMs"],
    attempt: number
): number {
    if (backoffMs === undefined) {
        return ZERO_MS;
    }

    if (typeof backoffMs === "function") {
        return backoffMs(attempt);
    }

    return backoffMs;
}

async function sleepWithSignal(
    delayMs: number,
    signal?: AbortSignal
): Promise<boolean> {
    if (signal?.aborted === true) {
        return false;
    }

    if (delayMs <= ZERO_MS) {
        return true;
    }

    const { promise, resolve } = Promise.withResolvers<boolean>();
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;

    const onAbort = (): void => {
        if (timer !== undefined) {
            globalThis.clearTimeout(timer);
        }
        resolve(false);
    };

    timer = globalThis.setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve(true);
    }, delayMs);

    signal?.addEventListener("abort", onAbort, { once: true });

    return promise;
}

/**
 * Runs an `AsyncResult`-returning operation with a deadline and an
 * `AbortSignal`. Clears its timer on completion so no handles leak, and
 * forwards cancellation from an optional outer `signal`.
 *
 * @param {(signal: AbortSignal) => Promise<R>} fn - The operation to run.
 * @param {number} timeoutMs - Deadline in milliseconds.
 * @param {TimeoutOptions} [options] - Optional outer abort signal.
 * @returns {AsyncResult<
 *     SuccessValue<R>,
 *     ErrorValue<R> | TimeoutError | AbortedError
 * >}
 *   The settled result, a `Timeout` error, or an `Aborted` error.
 */
async function withTimeout<R extends Result<unknown, unknown>>(
    fn: (signal: AbortSignal) => Promise<R>,
    timeoutMs: number,
    options?: TimeoutOptions
): AsyncResult<SuccessValue<R>, ErrorValue<R> | TimeoutError | AbortedError>;
async function withTimeout(
    fn: (signal: AbortSignal) => Promise<Result<unknown, unknown>>,
    timeoutMs: number,
    options?: TimeoutOptions
): AsyncResult<unknown, unknown> {
    const outerSignal = options?.signal;
    if (outerSignal?.aborted === true) {
        return err(
            taggedError("Aborted", { reason: readAbortReason(outerSignal) })
        );
    }

    const controller = new globalThis.AbortController();
    let timedOut = false;

    const onOuterAbort = (): void => {
        controller.abort(readAbortReason(outerSignal));
    };

    outerSignal?.addEventListener("abort", onOuterAbort, { once: true });

    const { promise: timeoutOutcome, resolve } =
        Promise.withResolvers<Result<unknown, unknown>>();

    const onAbort = (): void => {
        if (timedOut) {
            resolve(err(taggedError("Timeout", { timeoutMs })));
            return;
        }
        resolve(
            err(
                taggedError("Aborted", {
                    reason: readAbortReason(controller.signal)
                })
            )
        );
    };

    controller.signal.addEventListener("abort", onAbort, { once: true });

    const timer = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort(taggedError("Timeout", { timeoutMs }));
    }, timeoutMs);

    try {
        return await Promise.race([fn(controller.signal), timeoutOutcome]);
    } finally {
        globalThis.clearTimeout(timer);
        outerSignal?.removeEventListener("abort", onOuterAbort);
    }
}

/**
 * Retries an `AsyncResult`-returning operation up to `maxAttempts` times with
 * optional backoff, `retryIf` predicate and `AbortSignal` support.
 *
 * @param {(attempt: number, signal?: AbortSignal) => Promise<R>} fn - Operation
 *   receiving the 1-based attempt number.
 * @param {RetryOptions<ErrorValue<R>>} options - Retry policy.
 * @returns {AsyncResult<SuccessValue<R>, ErrorValue<R> | AbortedError>} The
 *   first success, the last failure, or an `Aborted` error if cancelled.
 */
async function withRetry<R extends Result<unknown, unknown>>(
    fn: (attempt: number, signal?: AbortSignal) => Promise<R>,
    options: RetryOptions<ErrorValue<R>>
): AsyncResult<SuccessValue<R>, ErrorValue<R> | AbortedError>;
async function withRetry(
    fn: (
        attempt: number,
        signal?: AbortSignal
    ) => Promise<Result<unknown, unknown>>,
    options: RetryOptions<unknown>
): AsyncResult<unknown, unknown> {
    const { backoffMs, maxAttempts, retryIf, signal } = options;
    const attempts = Math.max(FIRST_ATTEMPT, Math.floor(maxAttempts));

    async function runAttempt(attempt: number): AsyncResult<unknown, unknown> {
        if (signal?.aborted === true) {
            return err(
                taggedError("Aborted", { reason: readAbortReason(signal) })
            );
        }

        const settled = await fn(attempt, signal);
        if (isSuccess(settled)) {
            return settled;
        }

        const isLastAttempt = attempt >= attempts;
        if (
            isLastAttempt ||
            (retryIf !== undefined && !retryIf(settled.value, attempt))
        ) {
            return settled;
        }

        const delayMs = resolveBackoffMs(backoffMs, attempt);
        const completed = await sleepWithSignal(delayMs, signal);
        if (!completed) {
            return err(
                taggedError("Aborted", { reason: readAbortReason(signal) })
            );
        }

        return runAttempt(attempt + NEXT_ATTEMPT_STEP);
    }

    return runAttempt(FIRST_ATTEMPT);
}

export { withRetry, withTimeout };
export type { AbortedError, RetryOptions, TimeoutError, TimeoutOptions };
