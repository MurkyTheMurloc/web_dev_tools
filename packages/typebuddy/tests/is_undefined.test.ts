import { isUndefined } from "../src/type_helper.js";

describe("isUndefined", () => {
    it("should return true for undefined inputs", () => {
        expect(isUndefined(undefined)).toBe(true);
    });

    it("should return false for non-undefined inputs", () => {
        expect(isUndefined("Hello")).toBe(false);
        expect(isUndefined(123)).toBe(false);
        expect(isUndefined({})).toBe(false);
        expect(isUndefined([])).toBe(false);
        expect(isUndefined(null)).toBe(false);
        expect(isUndefined(Symbol())).toBe(false);
        expect(isUndefined(NaN)).toBe(false);
    });
});
