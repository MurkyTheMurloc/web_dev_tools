import { isDate } from "../src/type_helper.js";

describe("isDate", () => {
    it("should return true for date inputs", () => {
        expect(isDate(new Date())).toBe(true);
    });

    it("should return false for non-date inputs", () => {
        expect(isDate("Hello")).toBe(false);
        expect(isDate(123)).toBe(false);
        expect(isDate({})).toBe(false);
        expect(isDate([])).toBe(false);
        expect(isDate(null)).toBe(false);
        expect(isDate(undefined)).toBe(false);
        expect(isDate(Symbol())).toBe(false);
        expect(isDate(NaN)).toBe(false);
    });
});
