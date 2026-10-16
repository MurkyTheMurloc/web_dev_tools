import { describe, expect, it, vi } from "vitest";

import { isInteger } from "../src/type_helper.js";

describe("isInteger", () => {
    it("should not log while checking non-integer values", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(isInteger("Hello")).toBeFalsy();
        expect(isInteger({})).toBeFalsy();
        expect(isInteger(null)).toBeFalsy();

        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it("should return true for integer inputs", () => {
        expect(isInteger(123)).toBeTruthy();
        expect(isInteger(-123)).toBeTruthy();
        expect(isInteger(0)).toBeTruthy();
    });

    it("should return false for non-integer inputs", () => {
        expect(isInteger("Hello")).toBeFalsy();
        expect(isInteger(-123.45)).toBeFalsy();
        expect(isInteger(123.45)).toBeFalsy();
        expect(isInteger({})).toBeFalsy();
        expect(isInteger([])).toBeFalsy();
        expect(isInteger(null)).toBeFalsy();
        expect(isInteger(undefined)).toBeFalsy();
        expect(isInteger(Symbol("test"))).toBeFalsy();
        expect(isInteger(Number.NaN)).toBeFalsy();
    });
});
