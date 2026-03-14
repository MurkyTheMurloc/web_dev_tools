import { isArray } from "../src/type_helper.js";

describe("isArray", () => {
    it("should return true for array inputs", () => {
        expect(isArray([])).toBe(true);
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray([[]])).toBe(true);
        expect(isArray([{}])).toBe(true);
        expect(isArray([1, "Hello", { a: 1 }])).toBe(true);
    });

    it("should return false for non-array inputs", () => {
        expect(isArray("Hello")).toBe(false);
        expect(isArray(123)).toBe(false);
        expect(isArray({})).toBe(false);
        expect(isArray(null)).toBe(false);
        expect(isArray(undefined)).toBe(false);
    });
});
