import { describe, expect, expectTypeOf, it } from "vitest";

import { err, isSuccess, ok } from "../src/result.js";
import type { Failed, Result, Success } from "../src/types/index.js";

interface User {
    readonly name: string;
}

// The unchecked payload a caller wraps in a Result before it has been parsed:
// `JSON.parse` of a plain string is typed `any` by the standard library. This
// is the realistic way a `Result<any>` comes about.
const uncheckedPayload = JSON.parse('"anything"');
type UncheckedPayload = typeof uncheckedPayload;

function firstValue<T>(result: Result<T>, fallback: T): T {
    if (isSuccess(result)) {
        return result.value;
    }

    return fallback;
}

describe("Result types", () => {
    it("types ok(null) as a success, like the runtime value", () => {
        const result = ok(null);

        expectTypeOf(result.isError).toEqualTypeOf<false>();
        expectTypeOf(result).toEqualTypeOf<Success<null>>();
        expect(result.isError).toBeFalsy();
    });

    it("types err() as a failure with a null value", () => {
        const result = err();

        expectTypeOf(result).toEqualTypeOf<Failed>();
        expectTypeOf(result.isError).toEqualTypeOf<true>();
        expectTypeOf(result.value).toEqualTypeOf<null>();
    });

    it("keeps Success and Failed apart when the payload is nullable", () => {
        expectTypeOf<Success<null>["isError"]>().toEqualTypeOf<false>();
        expectTypeOf<
            Success<string | null>["isError"]
        >().toEqualTypeOf<false>();
        expectTypeOf<Failed["isError"]>().toEqualTypeOf<true>();
    });

    it("accepts a Result whose success value is nullable", () => {
        const load = (): Result<User | null> => {
            return ok(null);
        };
        const result = load();

        if (isSuccess(result)) {
            expectTypeOf(result.value).toEqualTypeOf<User | null>();
        } else {
            expectTypeOf(result).toEqualTypeOf<Failed>();
        }

        expect(isSuccess(result)).toBeTruthy();
    });

    it("accepts a generic Result<T>", () => {
        expect(firstValue(ok("a"), "fallback")).toBe("a");
        expect(firstValue(err(), "fallback")).toBe("fallback");
    });

    it("narrows Result<any> to a success, not to never", () => {
        const load = (): Result<UncheckedPayload> => {
            return ok("anything");
        };
        const result = load();

        if (isSuccess(result)) {
            expectTypeOf(result).toEqualTypeOf<Success<UncheckedPayload>>();
            expectTypeOf(result.value).toBeAny();
        }

        expect(isSuccess(result)).toBeTruthy();
    });

    it("narrows the else branch to the failure", () => {
        const load = (): Result<string> => {
            return err();
        };
        const result = load();

        if (isSuccess(result)) {
            throw new Error("Expected a failure.");
        }

        expectTypeOf(result).toEqualTypeOf<Failed>();
        expect(result.value).toBeNull();
    });
});
