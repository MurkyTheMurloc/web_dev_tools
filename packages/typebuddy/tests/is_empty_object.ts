import { describe, expect, it } from "vitest";

import { isEmptyObject } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isEmptyObject, () => {
    it("should return true for plain object inputs", () => {
        expect(isEmptyObject({})).toBeTruthy();
    });

    it("should return false for non-plain object inputs", () => {
        expect(isEmptyObject(new Date())).toBeFalsy();
        expect(isEmptyObject(/abc/)).toBeFalsy();
        expect(isEmptyObject(/abc/u)).toBeFalsy();
        expect(isEmptyObject(new Error("test"))).toBeFalsy();
        expect(isEmptyObject("Hello")).toBeFalsy();
        expect(isEmptyObject(NUM_123)).toBeFalsy();
        expect(isEmptyObject([])).toBeFalsy();
        expect(isEmptyObject(null)).toBeFalsy();
        expect(isEmptyObject(missingValue)).toBeFalsy();
        expect(isEmptyObject(Symbol("test"))).toBeFalsy();
        expect(isEmptyObject(Number.NaN)).toBeFalsy();
        expect(isEmptyObject({ a: 1, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: null, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: undefined, b: 2 })).toBeFalsy();
    });
});
