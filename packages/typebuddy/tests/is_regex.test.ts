import { describe, expect, it } from "vitest";

import { isRegExp } from "../src/type_helper.js";

describe("isRegExp", () => {
    it("should return true for RegExp inputs", () => {
        expect(isRegExp(/abc/)).toBeTruthy();
        expect(isRegExp(new RegExp("abc"))).toBeTruthy();
    });

    it("should return false for non-RegExp inputs", () => {
        expect(isRegExp("Hello")).toBeFalsy();
        expect(isRegExp(123)).toBeFalsy();
        expect(isRegExp({})).toBeFalsy();
        expect(isRegExp([])).toBeFalsy();
        expect(isRegExp(null)).toBeFalsy();
        expect(isRegExp(undefined)).toBeFalsy();
        expect(isRegExp(Symbol("test"))).toBeFalsy();
        expect(isRegExp(Number.NaN)).toBeFalsy();
    });
});
