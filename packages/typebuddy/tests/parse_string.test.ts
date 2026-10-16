import { describe, expect, it } from "vitest";

import { parseString } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(parseString, () => {
    it("should return the string representation of the input", () => {
        expect(parseString("Hello")).toBe("Hello");
        expect(parseString(NUM_123)).toBe("123");
        expect(parseString({})).toBe("");
        expect(parseString([])).toBe("");
        expect(parseString(null)).toBe("");
        expect(parseString(missingValue)).toBe("");
    });
});
