import { describe, expect, it } from "vitest";

import { isDate } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isDate, () => {
    it("should return true for date inputs", () => {
        expect(isDate(new Date())).toBeTruthy();
    });

    it("should return false for non-date inputs", () => {
        expect(isDate("Hello")).toBeFalsy();
        expect(isDate(NUM_123)).toBeFalsy();
        expect(isDate({})).toBeFalsy();
        expect(isDate([])).toBeFalsy();
        expect(isDate(null)).toBeFalsy();
        expect(isDate(missingValue)).toBeFalsy();
        expect(isDate(Symbol("test"))).toBeFalsy();
        expect(isDate(Number.NaN)).toBeFalsy();
    });
});
