import { describe, expect, it } from "vitest";

import { isArray } from "../src/type_helper.js";

describe("isArray", () => {
    it("should return true for array inputs", () => {
        expect(isArray([])).toBeTruthy();
        expect(isArray([1, 2, 3])).toBeTruthy();
        expect(isArray([[]])).toBeTruthy();
        expect(isArray([{}])).toBeTruthy();
        expect(isArray([1, "Hello", { a: 1 }])).toBeTruthy();
    });

    it("should return false for non-array inputs", () => {
        expect(isArray("Hello")).toBeFalsy();
        expect(isArray(123)).toBeFalsy();
        expect(isArray({})).toBeFalsy();
        expect(isArray(null)).toBeFalsy();
        expect(isArray(undefined)).toBeFalsy();
    });
});
