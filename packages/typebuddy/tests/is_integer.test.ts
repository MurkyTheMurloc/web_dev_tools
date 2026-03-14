import { isInteger } from "../src/type_helper.js";

describe("isInteger", () => {
    it("should return true for integer inputs", () => {
        expect(isInteger(123)).toBe(true);
        expect(isInteger(-123)).toBe(true);
        expect(isInteger(0)).toBe(true);
    });

    it("should return false for non-integer inputs", () => {
        expect(isInteger("Hello")).toBe(false);
        expect(isInteger(-123.45)).toBe(false);
        expect(isInteger(123.45)).toBe(false);
        expect(isInteger({})).toBe(false);
        expect(isInteger([])).toBe(false);
        expect(isInteger(null)).toBe(false);
        expect(isInteger(undefined)).toBe(false);
        expect(isInteger(Symbol())).toBe(false);
        expect(isInteger(NaN)).toBe(false);
    });
});
