import { isEmptyObject } from "../src/type_helper.js";

describe("isEmptyObject", () => {
    it("should return true for plain object inputs", () => {
        expect(isEmptyObject({})).toBe(true);
    });

    it("should return false for non-plain object inputs", () => {
        expect(isEmptyObject(new Date())).toBe(false);
        expect(isEmptyObject(/abc/)).toBe(false);
        expect(isEmptyObject(new RegExp("abc"))).toBe(false);
        expect(isEmptyObject(new Error())).toBe(false);
        expect(isEmptyObject("Hello")).toBe(false);
        expect(isEmptyObject(123)).toBe(false);
        expect(isEmptyObject([])).toBe(false);
        expect(isEmptyObject(null)).toBe(false);
        expect(isEmptyObject(undefined)).toBe(false);
        expect(isEmptyObject(Symbol())).toBe(false);
        expect(isEmptyObject(NaN)).toBe(false);
        expect(isEmptyObject({ a: 1, b: 2 })).toBe(false);
        expect(isEmptyObject({ a: null, b: 2 })).toBe(false);
        expect(isEmptyObject({ a: undefined, b: 2 })).toBe(false);
    });
});
