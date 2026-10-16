import { describe, expect, it } from "vitest";

import { isFloat } from "../src/type_helper.js";

const NUM_0_1 = 0.1;
const NUM_123 = 123;
const NUM_1_1 = 1.1;
const NUM_NEG_0_1 = -0.1;
const NUM_NEG_1_1 = -1.1;

const missingValue: unknown = undefined;

describe(isFloat, () => {
    it("should return true for float inputs", () => {
        expect(isFloat(NUM_1_1)).toBeTruthy();
        expect(isFloat(NUM_0_1)).toBeTruthy();
        expect(isFloat(NUM_NEG_1_1)).toBeTruthy();
        expect(isFloat(NUM_NEG_0_1)).toBeTruthy();
    });

    it("should return false for non-float inputs", () => {
        expect(isFloat("Hello")).toBeFalsy();
        expect(isFloat(NUM_123)).toBeFalsy();
        expect(isFloat({})).toBeFalsy();
        expect(isFloat([])).toBeFalsy();
        expect(isFloat(null)).toBeFalsy();
        expect(isFloat(missingValue)).toBeFalsy();
        expect(isFloat(Symbol("test"))).toBeFalsy();
        expect(isFloat(Number.NaN)).toBeFalsy();
    });
});
