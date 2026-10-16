import { describe, expect, it } from "vitest";

import { isUndefined } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isUndefined, () => {
    it("should return true for undefined inputs", () => {
        expect(isUndefined(missingValue)).toBeTruthy();
    });

    it("should return false for non-undefined inputs", () => {
        expect(isUndefined("Hello")).toBeFalsy();
        expect(isUndefined(NUM_123)).toBeFalsy();
        expect(isUndefined({})).toBeFalsy();
        expect(isUndefined([])).toBeFalsy();
        expect(isUndefined(null)).toBeFalsy();
        expect(isUndefined(Symbol("test"))).toBeFalsy();
        expect(isUndefined(Number.NaN)).toBeFalsy();
    });
});
