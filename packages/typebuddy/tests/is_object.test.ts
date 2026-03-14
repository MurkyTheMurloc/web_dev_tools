import { isObject } from "../src/type_helper.js";

describe("isObject", () => {
    it("should return true for object inputs", () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
        expect(isObject({ a: { b: 2 } })).toBe(true);
        expect(isObject([{ a: 1 }])).toBe(false);
        expect(isObject([])).toBe(false);
        expect(isObject(null)).toBe(false);
        expect(isObject(undefined)).toBe(false);
    });

    it("should return false for non-object inputs", () => {
        expect(isObject("Hello")).toBe(false);
        expect(isObject(123)).toBe(false);
    });
});
