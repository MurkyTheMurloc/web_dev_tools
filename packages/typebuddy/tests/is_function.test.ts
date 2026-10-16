import { describe, expect, it } from "vitest";

import { isFunction } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

function noop(): void {
    // intentionally empty
}

describe(isFunction, () => {
    it("should return true for function inputs", () => {
        expect(isFunction(noop)).toBeTruthy();
        expect(isFunction(function named(): void {
            // intentionally empty
        })).toBeTruthy();
    });

    it("should return false for non-function inputs", () => {
        expect(isFunction("Hello")).toBeFalsy();
        expect(isFunction(NUM_123)).toBeFalsy();
        expect(isFunction({})).toBeFalsy();
        expect(isFunction([])).toBeFalsy();
        expect(isFunction(null)).toBeFalsy();
        expect(isFunction(missingValue)).toBeFalsy();
        expect(isFunction(Symbol("test"))).toBeFalsy();
        expect(isFunction(Number.NaN)).toBeFalsy();
    });
});
