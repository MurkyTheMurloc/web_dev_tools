import { describe, expect, it } from "vitest";

import { isError } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isError, () => {
    it("should return true for error inputs", () => {
        expect(isError(new Error("test"))).toBeTruthy();
    });

    it("should return false for non-error inputs", () => {
        expect(isError("Hello")).toBeFalsy();
        expect(isError(NUM_123)).toBeFalsy();
        expect(isError({})).toBeFalsy();
        expect(isError([])).toBeFalsy();
        expect(isError(null)).toBeFalsy();
        expect(isError(missingValue)).toBeFalsy();
        expect(isError(Symbol("test"))).toBeFalsy();
        expect(isError(Number.NaN)).toBeFalsy();
    });
});
