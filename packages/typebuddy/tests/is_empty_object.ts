import { describe, expect, it } from "vitest";

import { isEmptyObject } from "../src/type_helper.js";

describe("isEmptyObject", () => {
    it("should return true for plain object inputs", () => {
        expect(isEmptyObject({})).toBeTruthy();
    });

    it("should return false for non-plain object inputs", () => {
        expect(isEmptyObject(new Date())).toBeFalsy();
        expect(isEmptyObject(/abc/)).toBeFalsy();
        expect(isEmptyObject(new RegExp("abc"))).toBeFalsy();
        expect(isEmptyObject(new Error())).toBeFalsy();
        expect(isEmptyObject("Hello")).toBeFalsy();
        expect(isEmptyObject(123)).toBeFalsy();
        expect(isEmptyObject([])).toBeFalsy();
        expect(isEmptyObject(null)).toBeFalsy();
        expect(isEmptyObject(undefined)).toBeFalsy();
        expect(isEmptyObject(Symbol("test"))).toBeFalsy();
        expect(isEmptyObject(Number.NaN)).toBeFalsy();
        expect(isEmptyObject({ a: 1, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: null, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: undefined, b: 2 })).toBeFalsy();
    });
});
