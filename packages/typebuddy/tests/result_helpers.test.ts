import { describe, expect, it } from "vitest";

import { err, isSuccess, ok } from "../src/type_helper.js";
import type { Result } from "../src/types/index.js";

describe("ok and err", () => {
    it("should build success objects with payloads", () => {
        expect(ok("ready")).toEqual({
            isError: false,
            value: "ready",
        });
    });

    it("should build a void success without an explicit payload", () => {
        expect(ok()).toEqual({
            isError: false,
            value: undefined,
        });
    });

    it("should build the default failed result", () => {
        expect(err()).toEqual({
            isError: true,
            value: null,
        });
    });

    it("should align with isSuccess narrowing", () => {
        expect(isSuccess(ok("x"))).toBeTruthy();
        expect(isSuccess(err())).toBeFalsy();
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
});
