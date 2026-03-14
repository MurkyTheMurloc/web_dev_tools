import { isBoolean } from "../src/type_helper.js";

describe("isBoolean", () => {
    it("should return true for boolean inputs", () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
    });

    it("should return false for non-boolean inputs", () => {
        expect(isBoolean("Hello")).toBe(false);
        expect(isBoolean(123)).toBe(false);
        expect(isBoolean({})).toBe(false);
        expect(isBoolean([])).toBe(false);
        expect(isBoolean(null)).toBe(false);
        expect(isBoolean(undefined)).toBe(false);
    });
});
