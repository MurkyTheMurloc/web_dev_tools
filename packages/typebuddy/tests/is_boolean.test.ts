import { describe, expect, it } from "vitest";

import { isBoolean } from "../src/type_helper.js";

describe("isBoolean", () => {
    it("should return true for boolean inputs", () => {
        expect(isBoolean(true)).toBeTruthy();
        expect(isBoolean(false)).toBeTruthy();
    });

    it("should return false for non-boolean inputs", () => {
        expect(isBoolean("Hello")).toBeFalsy();
        expect(isBoolean(123)).toBeFalsy();
        expect(isBoolean({})).toBeFalsy();
        expect(isBoolean([])).toBeFalsy();
        expect(isBoolean(null)).toBeFalsy();
        expect(isBoolean(undefined)).toBeFalsy();
    });
});
