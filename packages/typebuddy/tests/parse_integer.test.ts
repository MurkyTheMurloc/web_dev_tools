import { parseInteger } from "../src/type_helper.js";

describe("parseInteger", () => {
    it("should parse strict integer-like values", () => {
        expect(parseInteger(42)).toBe(42);
        expect(parseInteger(42.9)).toBe(42);
        expect(parseInteger("42")).toBe(42);
        expect(parseInteger(" 42 ")).toBe(42);
        expect(parseInteger("1e3")).toBe(1000);
    });

    it("should reject partial or non-integer strings", () => {
        expect(parseInteger("42px")).toBeUndefined();
        expect(parseInteger("4.2")).toBeUndefined();
        expect(parseInteger("Infinity")).toBeUndefined();
    });
});
