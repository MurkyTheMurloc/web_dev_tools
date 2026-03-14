import { isNull } from "../src/type_helper.js";

describe("isNull", () => {
    it("should return true for null inputs", () => {
        expect(isNull(null)).toBe(true);
    });

    it("should return false for non-null inputs", () => {
        expect(isNull("Hello")).toBe(false);
        expect(isNull(123)).toBe(false);
        expect(isNull({})).toBe(false);
        expect(isNull([])).toBe(false);
        expect(isNull(undefined)).toBe(false);
        expect(isNull(Symbol())).toBe(false);
        expect(isNull(NaN)).toBe(false);
    });
});
