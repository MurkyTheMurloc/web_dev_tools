import { describe, expect, it } from "vitest";

import { withRetry, withTimeout } from "../src/async.js";
import { err, isErr, isSuccess, ok, taggedError } from "../src/result.js";

describe("withTimeout", () => {
    it("resolves with the inner AsyncResult when completed before the deadline", async () => {
        const result = await withTimeout(async () => {
            await Promise.resolve();
            return ok("done");
        }, 500);

        expect(result).toEqual(ok("done"));
    });

    it("aborts and returns a Timeout error when the deadline elapses", async () => {
        let sawAbort = false;

        const result = await withTimeout(async (signal) => {
            await new Promise<void>((resolve) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        sawAbort = true;
                        resolve();
                    },
                    { once: true }
                );
            });
            return ok("too-late");
        }, 15);

        expect(sawAbort).toBeTruthy();
        expect(isErr(result) && result.value._tag).toBe("Timeout");
        if (isErr(result) && result.value._tag === "Timeout") {
            expect(result.value.timeoutMs).toBe(15);
        }
    });

    it("returns Aborted when the outer signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort("cancelled");

        let called = false;
        const result = await withTimeout(
            async () => {
                called = true;
                await Promise.resolve();
                return ok("never");
            },
            100,
            { signal: controller.signal }
        );

        expect(called).toBeFalsy();
        expect(isErr(result) && result.value._tag).toBe("Aborted");
        if (isErr(result) && result.value._tag === "Aborted") {
            expect(result.value.reason).toBe("cancelled");
        }
    });
});

describe("withRetry", () => {
    it("retries failures until an attempt succeeds", async () => {
        const attempts: number[] = [];

        const result = await withRetry(
            async (attempt) => {
                attempts.push(attempt);
                await Promise.resolve();
                if (attempt < 3) {
                    return err(taggedError("Transient", { attempt }));
                }
                return ok("recovered");
            },
            { backoffMs: 1, maxAttempts: 4 }
        );

        expect(attempts).toEqual([1, 2, 3]);
        expect(isSuccess(result) && result.value).toBe("recovered");
    });

    it("stops early when retryIf returns false", async () => {
        let calls = 0;

        const result = await withRetry(
            async () => {
                calls += 1;
                await Promise.resolve();
                return err(taggedError("Permanent"));
            },
            {
                maxAttempts: 5,
                retryIf: (error) => {
                    return error._tag !== "Permanent";
                }
            }
        );

        expect(calls).toBe(1);
        expect(isErr(result) && result.value._tag).toBe("Permanent");
    });

    it("returns Aborted when cancelled during backoff", async () => {
        const controller = new AbortController();

        const result = await withRetry(
            async () => {
                setTimeout(() => {
                    controller.abort("stop");
                }, 5);
                await Promise.resolve();
                return err(taggedError("Retryable"));
            },
            {
                backoffMs: 200,
                maxAttempts: 3,
                signal: controller.signal
            }
        );

        expect(isErr(result) && result.value._tag).toBe("Aborted");
    });
});
