import { isRegExp } from "../src/type_helper.js";

describe("isRegExp", () => {
    it("should return true for RegExp inputs", () => {
        expect(isRegExp(/abc/)).toBe(true);
        expect(isRegExp(new RegExp("abc"))).toBe(true);
    });

    it("should return false for non-RegExp inputs", () => {
        expect(isRegExp("Hello")).toBe(false);
        expect(isRegExp(123)).toBe(false);
        expect(isRegExp({})).toBe(false);
        expect(isRegExp([])).toBe(false);
        expect(isRegExp(null)).toBe(false);
        expect(isRegExp(undefined)).toBe(false);
        expect(isRegExp(Symbol())).toBe(false);
        expect(isRegExp(NaN)).toBe(false);
    });
});
