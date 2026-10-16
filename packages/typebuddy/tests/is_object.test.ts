import { describe, expect, it } from "vitest";

import { isObject } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isObject, () => {
    it("should return true for object inputs", () => {
        expect(isObject({})).toBeTruthy();
        expect(isObject({ a: 1 })).toBeTruthy();
        expect(isObject({ a: { b: 2 } })).toBeTruthy();
        expect(isObject([{ a: 1 }])).toBeFalsy();
        expect(isObject([])).toBeFalsy();
        expect(isObject(null)).toBeFalsy();
        expect(isObject(missingValue)).toBeFalsy();
    });

    it("should return false for non-object inputs", () => {
        expect(isObject("Hello")).toBeFalsy();
        expect(isObject(NUM_123)).toBeFalsy();
    });
});
