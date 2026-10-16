import { describe, expect, it } from "vitest";

import { isBoolean } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isBoolean, () => {
    it("should return true for boolean inputs", () => {
        expect(isBoolean(true)).toBeTruthy();
        expect(isBoolean(false)).toBeTruthy();
    });

    it("should return false for non-boolean inputs", () => {
        expect(isBoolean("Hello")).toBeFalsy();
        expect(isBoolean(NUM_123)).toBeFalsy();
        expect(isBoolean({})).toBeFalsy();
        expect(isBoolean([])).toBeFalsy();
        expect(isBoolean(null)).toBeFalsy();
        expect(isBoolean(missingValue)).toBeFalsy();
    });
});
