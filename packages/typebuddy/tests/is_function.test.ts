import { isFunction } from "../src/type_helper.js";

describe("isFunction", () => {
    it("should return true for function inputs", () => {
        expect(isFunction(() => {})).toBe(true);
        expect(isFunction(function () {})).toBe(true);
    });

    it("should return false for non-function inputs", () => {
        expect(isFunction("Hello")).toBe(false);
        expect(isFunction(123)).toBe(false);
        expect(isFunction({})).toBe(false);
        expect(isFunction([])).toBe(false);
        expect(isFunction(null)).toBe(false);
        expect(isFunction(undefined)).toBe(false);
        expect(isFunction(Symbol())).toBe(false);
        expect(isFunction(NaN)).toBe(false);
    });
});
