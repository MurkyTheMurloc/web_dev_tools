import { describe, expect, it, vi } from "vitest";

import { isInteger } from "../src/type_helper.js";

const NUM_0 = 0;
const NUM_123 = 123;
const NUM_123_45 = 123.45;
const NUM_NEG_123 = -123;
const NUM_NEG_123_45 = -123.45;

const missingValue: unknown = undefined;

function noop(): void {
    // intentionally empty
}

describe(isInteger, () => {
    it("should not log while checking non-integer values", () => {
        const errorSpy = vi.spyOn(globalThis.console, "error").mockImplementation(noop);

        expect(isInteger("Hello")).toBeFalsy();
        expect(isInteger({})).toBeFalsy();
        expect(isInteger(null)).toBeFalsy();

        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it("should return true for integer inputs", () => {
        expect(isInteger(NUM_123)).toBeTruthy();
        expect(isInteger(NUM_NEG_123)).toBeTruthy();
        expect(isInteger(NUM_0)).toBeTruthy();
    });

    it("should return false for non-integer inputs", () => {
        expect(isInteger("Hello")).toBeFalsy();
        expect(isInteger(NUM_NEG_123_45)).toBeFalsy();
        expect(isInteger(NUM_123_45)).toBeFalsy();
        expect(isInteger({})).toBeFalsy();
        expect(isInteger([])).toBeFalsy();
        expect(isInteger(null)).toBeFalsy();
        expect(isInteger(missingValue)).toBeFalsy();
        expect(isInteger(Symbol("test"))).toBeFalsy();
        expect(isInteger(Number.NaN)).toBeFalsy();
    });
});
