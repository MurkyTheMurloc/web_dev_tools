import { isString } from "../src/type_helper.js";

describe("isString", () => {
    it("should return true for string inputs", () => {
        expect(isString("Hello")).toBe(true);
    });

    it("should return false for non-string inputs", () => {
        expect(isString(123)).toBe(false);
        expect(isString({})).toBe(false);
        expect(isString([])).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(undefined)).toBe(false);
    });
});
