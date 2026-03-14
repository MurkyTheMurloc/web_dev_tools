import { isEmptyString } from "../src/type_helper.js";

describe("isEmptyString", () => {
    it("should return true for empty string inputs", () => {
        expect(isEmptyString("")).toBe(true);
    });

    it("should return false for non-empty string inputs", () => {
        expect(isEmptyString("Hello")).toBe(false);
        expect(isEmptyString("123")).toBe(false);
        expect(isEmptyString(123)).toBe(false);
    });
});
