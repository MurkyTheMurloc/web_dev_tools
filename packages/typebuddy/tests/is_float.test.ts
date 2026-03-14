import { isFloat } from "../src/type_helper.js";

describe("isFloat", () => {
    it("should return true for float inputs", () => {
        expect(isFloat(1.1)).toBe(true);
        expect(isFloat(0.1)).toBe(true);
        expect(isFloat(-1.1)).toBe(true);
        expect(isFloat(-0.1)).toBe(true);
        expect(isFloat(1.0)).toBe(true);
        expect(isFloat(0.0)).toBe(true);
        expect(isFloat(-1.0)).toBe(true);
        expect(isFloat(-0.0)).toBe(true);
    });

    it("should return false for non-float inputs", () => {
        expect(isFloat("Hello")).toBe(false);
        expect(isFloat(123)).toBe(false);
        expect(isFloat({})).toBe(false);
        expect(isFloat([])).toBe(false);
        expect(isFloat(null)).toBe(false);
        expect(isFloat(undefined)).toBe(false);
        expect(isFloat(Symbol())).toBe(false);
        expect(isFloat(NaN)).toBe(false);
    });
});
