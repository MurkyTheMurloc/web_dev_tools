import { describe, expect, it } from "vitest";

import { isString } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isString, () => {
    it("should return true for string inputs", () => {
        expect(isString("Hello")).toBeTruthy();
    });

    it("should return false for non-string inputs", () => {
        expect(isString(NUM_123)).toBeFalsy();
        expect(isString({})).toBeFalsy();
        expect(isString([])).toBeFalsy();
        expect(isString(null)).toBeFalsy();
        expect(isString(missingValue)).toBeFalsy();
    });
});
