import { describe, expect, it } from "vitest";

import { isSymbol } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isSymbol, () => {
    it("should return true for symbol inputs", () => {
        expect(isSymbol(Symbol("test"))).toBeTruthy();
    });

    it("should return false for non-symbol inputs", () => {
        expect(isSymbol("Hello")).toBeFalsy();
        expect(isSymbol(NUM_123)).toBeFalsy();
        expect(isSymbol({})).toBeFalsy();
        expect(isSymbol([])).toBeFalsy();
        expect(isSymbol(null)).toBeFalsy();
        expect(isSymbol(missingValue)).toBeFalsy();
    });
});
