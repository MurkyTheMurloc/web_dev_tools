import { describe, expect, it } from "vitest";

import { isString } from "../src/type_helper.js";

describe("isString", () => {
    it("should return true for string inputs", () => {
        expect(isString("Hello")).toBeTruthy();
    });

    it("should return false for non-string inputs", () => {
        expect(isString(123)).toBeFalsy();
        expect(isString({})).toBeFalsy();
        expect(isString([])).toBeFalsy();
        expect(isString(null)).toBeFalsy();
        expect(isString(undefined)).toBeFalsy();
    });
});
