import { describe, expect, it } from "vitest";

import { isNumber } from "../src/type_helper.js";

describe("isNumber", () => {
    it("should return true for number inputs", () => {
        expect(isNumber(123)).toBeTruthy();
        expect(isNumber(123.45)).toBeTruthy();
    });

    it("should return false for non-number inputs", () => {
        expect(isNumber("123")).toBeFalsy();
        expect(isNumber({})).toBeFalsy();
        expect(isNumber([])).toBeFalsy();
        expect(isNumber(null)).toBeFalsy();
        expect(isNumber(undefined)).toBeFalsy();
    });
});
