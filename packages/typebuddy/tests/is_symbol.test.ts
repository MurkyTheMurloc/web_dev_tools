import { isSymbol } from "../src/type_helper.js";

describe("isSymbol", () => {
    it("should return true for symbol inputs", () => {
        expect(isSymbol(Symbol())).toBe(true);
    });

    it("should return false for non-symbol inputs", () => {
        expect(isSymbol("Hello")).toBe(false);
        expect(isSymbol(123)).toBe(false);
        expect(isSymbol({})).toBe(false);
        expect(isSymbol([])).toBe(false);
        expect(isSymbol(null)).toBe(false);
        expect(isSymbol(undefined)).toBe(false);
    });
});
