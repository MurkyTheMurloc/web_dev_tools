import { describe, expect, it } from "vitest";

import { isDate } from "../src/type_helper.js";

describe("isDate", () => {
    it("should return true for date inputs", () => {
        expect(isDate(new Date())).toBeTruthy();
    });

    it("should return false for non-date inputs", () => {
        expect(isDate("Hello")).toBeFalsy();
        expect(isDate(123)).toBeFalsy();
        expect(isDate({})).toBeFalsy();
        expect(isDate([])).toBeFalsy();
        expect(isDate(null)).toBeFalsy();
        expect(isDate(undefined)).toBeFalsy();
        expect(isDate(Symbol("test"))).toBeFalsy();
        expect(isDate(Number.NaN)).toBeFalsy();
    });
});
