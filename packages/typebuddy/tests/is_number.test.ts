import { isNumber } from "../src/type_helper.js";

describe("isNumber", () => {
    it("should return true for number inputs", () => {
        expect(isNumber(123)).toBe(true);
        expect(isNumber(123.45)).toBe(true);
    });

    it("should return false for non-number inputs", () => {
        expect(isNumber("123")).toBe(false);
        expect(isNumber({})).toBe(false);
        expect(isNumber([])).toBe(false);
        expect(isNumber(null)).toBe(false);
        expect(isNumber(undefined)).toBe(false);
    });
});
