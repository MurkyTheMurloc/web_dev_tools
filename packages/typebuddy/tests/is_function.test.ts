import { describe, expect, it } from "vitest";

import { isFunction } from "../src/type_helper.js";

describe("isFunction", () => {
    it("should return true for function inputs", () => {
        expect(isFunction(() => {})).toBeTruthy();
        expect(isFunction(function () {})).toBeTruthy();
    });

    it("should return false for non-function inputs", () => {
        expect(isFunction("Hello")).toBeFalsy();
        expect(isFunction(123)).toBeFalsy();
        expect(isFunction({})).toBeFalsy();
        expect(isFunction([])).toBeFalsy();
        expect(isFunction(null)).toBeFalsy();
        expect(isFunction(undefined)).toBeFalsy();
        expect(isFunction(Symbol("test"))).toBeFalsy();
        expect(isFunction(Number.NaN)).toBeFalsy();
    });
});
