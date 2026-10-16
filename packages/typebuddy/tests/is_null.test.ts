import { describe, expect, it } from "vitest";

import { isNull } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isNull, () => {
    it("should return true for null inputs", () => {
        expect(isNull(null)).toBeTruthy();
    });

    it("should return false for non-null inputs", () => {
        expect(isNull("Hello")).toBeFalsy();
        expect(isNull(NUM_123)).toBeFalsy();
        expect(isNull({})).toBeFalsy();
        expect(isNull([])).toBeFalsy();
        expect(isNull(missingValue)).toBeFalsy();
        expect(isNull(Symbol("test"))).toBeFalsy();
        expect(isNull(Number.NaN)).toBeFalsy();
    });
});
