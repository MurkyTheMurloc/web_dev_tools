import { describe, expect, it } from "vitest";

import { isNumber } from "../src/type_helper.js";

const NUM_123 = 123;
const NUM_123_45 = 123.45;

const missingValue: unknown = undefined;

describe(isNumber, () => {
    it("should return true for number inputs", () => {
        expect(isNumber(NUM_123)).toBeTruthy();
        expect(isNumber(NUM_123_45)).toBeTruthy();
    });

    it("should return false for non-number inputs", () => {
        expect(isNumber("123")).toBeFalsy();
        expect(isNumber({})).toBeFalsy();
        expect(isNumber([])).toBeFalsy();
        expect(isNumber(null)).toBeFalsy();
        expect(isNumber(missingValue)).toBeFalsy();
    });
});
