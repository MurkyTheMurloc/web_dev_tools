import { describe, expect, it } from "vitest";

import { isRegExp } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isRegExp, () => {
    it("should return true for RegExp inputs", () => {
        expect(isRegExp(/abc/)).toBeTruthy();
        expect(isRegExp(/abc/u)).toBeTruthy();
    });

    it("should return false for non-RegExp inputs", () => {
        expect(isRegExp("Hello")).toBeFalsy();
        expect(isRegExp(NUM_123)).toBeFalsy();
        expect(isRegExp({})).toBeFalsy();
        expect(isRegExp([])).toBeFalsy();
        expect(isRegExp(null)).toBeFalsy();
        expect(isRegExp(missingValue)).toBeFalsy();
        expect(isRegExp(Symbol("test"))).toBeFalsy();
        expect(isRegExp(Number.NaN)).toBeFalsy();
    });
});
