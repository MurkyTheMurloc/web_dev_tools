import { parseString } from "../src/type_helper.js";

describe("parseString", () => {
    it("should return the string representation of the input", () => {
        expect(parseString("Hello")).toBe("Hello");
        expect(parseString(123)).toBe("123");
        expect(parseString({})).toBe("");
        expect(parseString([])).toBe("");
        expect(parseString(null)).toBe("");
        expect(parseString(undefined)).toBe("");
    });
});
