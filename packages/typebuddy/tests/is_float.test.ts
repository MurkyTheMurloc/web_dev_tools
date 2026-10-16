import { describe, expect, it } from "vitest";

import { isFloat } from "../src/type_helper.js";

describe("isFloat", () => {
    it("should return true for float inputs", () => {
        expect(isFloat(1.1)).toBeTruthy();
        expect(isFloat(0.1)).toBeTruthy();
        expect(isFloat(-1.1)).toBeTruthy();
        expect(isFloat(-0.1)).toBeTruthy();
    });

    it("should return false for non-float inputs", () => {
        expect(isFloat("Hello")).toBeFalsy();
        expect(isFloat(123)).toBeFalsy();
        expect(isFloat({})).toBeFalsy();
        expect(isFloat([])).toBeFalsy();
        expect(isFloat(null)).toBeFalsy();
        expect(isFloat(undefined)).toBeFalsy();
        expect(isFloat(Symbol("test"))).toBeFalsy();
        expect(isFloat(Number.NaN)).toBeFalsy();
    });
});
