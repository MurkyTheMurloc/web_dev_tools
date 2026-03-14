import { isError } from "../src/type_helper.js";

describe("isError", () => {
    it("should return true for error inputs", () => {
        expect(isError(new Error())).toBe(true);
    });

    it("should return false for non-error inputs", () => {
        expect(isError("Hello")).toBe(false);
        expect(isError(123)).toBe(false);
        expect(isError({})).toBe(false);
        expect(isError([])).toBe(false);
        expect(isError(null)).toBe(false);
        expect(isError(undefined)).toBe(false);
        expect(isError(Symbol())).toBe(false);
        expect(isError(NaN)).toBe(false);
    });
});
