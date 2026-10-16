import { describe, expect, it } from "vitest";

import { isUndefined } from "../src/type_helper.js";

describe("isUndefined", () => {
    it("should return true for undefined inputs", () => {
        expect(isUndefined(undefined)).toBeTruthy();
    });

    it("should return false for non-undefined inputs", () => {
        expect(isUndefined("Hello")).toBeFalsy();
        expect(isUndefined(123)).toBeFalsy();
        expect(isUndefined({})).toBeFalsy();
        expect(isUndefined([])).toBeFalsy();
        expect(isUndefined(null)).toBeFalsy();
        expect(isUndefined(Symbol("test"))).toBeFalsy();
        expect(isUndefined(Number.NaN)).toBeFalsy();
    });
});
