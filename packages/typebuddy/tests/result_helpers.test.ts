import { describe, expect, it } from "vitest";

import {
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
} from "../src/type_helper.js";
import type { Result, TaggedError } from "../src/types/index.js";

describe("ok and err", () => {
    it("should build success objects with payloads", () => {
        expect(ok("ready")).toEqual({
            isError: false,
            value: "ready"
        });
    });

    it("should build a void success without an explicit payload", () => {
        expect(ok()).toEqual({
            isError: false,
            value: undefined
        });
    });

    it("should build the default failed result", () => {
        expect(err()).toEqual({
            isError: true,
            value: null
        });
    });

    it("should build typed failed results with payloads", () => {
        const failure = err(taggedError("NotFound", { id: "u_1" }));
        expect(failure).toEqual({
            isError: true,
            value: { _tag: "NotFound", id: "u_1" }
        });
    });

    it("should align with isSuccess and isErr narrowing", () => {
        expect(isSuccess(ok("x"))).toBeTruthy();
        expect(isSuccess(err())).toBeFalsy();
        expect(isErr(err("boom"))).toBeTruthy();
        expect(isErr(ok("x"))).toBeFalsy();
    });

    it("should narrow to the success value type without an extra null", () => {
        // through a function, so the declared union is not narrowed by the initializer
        const load = (): Result<readonly string[]> => {
            return ok(["a"]);
        };
        const result = load();

        if (!isSuccess(result)) {
            throw new Error("Expected a success.");
        }

        // Fails the typecheck when the guard widens the value to `T | null`.
        const narrowed: readonly string[] = result.value;
        expect(narrowed).toEqual(["a"]);
    });

    it("supports exhaustive switch with taggedError and assertNever", () => {
        type LoadError =
            | TaggedError<"NotFound", { readonly id: string }>
            | TaggedError<"Offline">;

        const describeError = (error: LoadError): string => {
            switch (error._tag) {
                case "NotFound": {
                    return `missing:${error.id}`;
                }
                case "Offline": {
                    return "offline";
                }
                default: {
                    return assertNever(error);
                }
            }
        };

        expect(describeError(taggedError("NotFound", { id: "42" }))).toBe(
            "missing:42"
        );
        expect(describeError(taggedError("Offline"))).toBe("offline");
        expect(() => {
            assertNever("boom" as never, "custom unreachable");
        }).toThrow("custom unreachable");
    });

    it("wraps sync and async boundaries with fromTry and fromPromise", async () => {
        const parsedOk = fromTry(
            () => JSON.parse('{"a":1}') as { a: number },
            (cause) => taggedError("InvalidJson", { cause })
        );
        expect(isSuccess(parsedOk) && parsedOk.value.a).toBe(1);

        const parsedErr = fromTry(
            () => JSON.parse("{") as unknown,
            (cause) => taggedError("InvalidJson", { cause })
        );
        expect(isErr(parsedErr) && parsedErr.value._tag).toBe("InvalidJson");

        const asyncOk = await fromPromise(Promise.resolve(7), () =>
            taggedError("Rejected")
        );
        expect(asyncOk).toEqual(ok(7));

        const asyncErr = await fromPromise(
            Promise.reject(new Error("down")),
            (cause) => taggedError("NetworkError", { cause })
        );
        expect(isErr(asyncErr) && asyncErr.value._tag).toBe("NetworkError");
    });

    it("transforms and combines results with unwrapOr, mapResult, mapError and allResults", () => {
        expect(unwrapOr(ok("a"), "fallback")).toBe("a");
        expect(unwrapOr(err("fail"), "fallback")).toBe("fallback");

        expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6));
        expect(mapResult(err("e"), (n: number) => n * 3)).toEqual(err("e"));

        expect(mapError(err("e"), (e) => `${e}!`)).toEqual(err("e!"));
        expect(mapError(ok(2), (e: string) => `${e}!`)).toEqual(ok(2));

        const combined = allResults([ok(1), ok("two")] as const);
        expect(combined).toEqual(ok([1, "two"]));

        const failed = allResults([
            ok(1),
            err(taggedError("First")),
            err(taggedError("Second"))
        ] as const);
        expect(failed).toEqual(err(taggedError("First")));
    });
});
