import { describe, expect, it } from "vitest";

import { isError } from "../src/type_helper.js";

describe("isError", () => {
    it("should return true for error inputs", () => {
        expect(isError(new Error())).toBeTruthy();
    });

    it("should return false for non-error inputs", () => {
        expect(isError("Hello")).toBeFalsy();
        expect(isError(123)).toBeFalsy();
        expect(isError({})).toBeFalsy();
        expect(isError([])).toBeFalsy();
        expect(isError(null)).toBeFalsy();
        expect(isError(undefined)).toBeFalsy();
        expect(isError(Symbol("test"))).toBeFalsy();
        expect(isError(Number.NaN)).toBeFalsy();
    });
});
