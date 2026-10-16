import { describe, expect, it } from "vitest";

import { isArray } from "../src/type_helper.js";

const NUM_1 = 1;
const NUM_123 = 123;
const NUM_2 = 2;
const NUM_3 = 3;

const missingValue: unknown = undefined;

describe(isArray, () => {
    it("should return true for array inputs", () => {
        expect(isArray([])).toBeTruthy();
        expect(isArray([NUM_1, NUM_2, NUM_3])).toBeTruthy();
        expect(isArray([[]])).toBeTruthy();
        expect(isArray([{}])).toBeTruthy();
        expect(isArray([NUM_1, "Hello", { a: 1 }])).toBeTruthy();
    });

    it("should return false for non-array inputs", () => {
        expect(isArray("Hello")).toBeFalsy();
        expect(isArray(NUM_123)).toBeFalsy();
        expect(isArray({})).toBeFalsy();
        expect(isArray(null)).toBeFalsy();
        expect(isArray(missingValue)).toBeFalsy();
    });
});
