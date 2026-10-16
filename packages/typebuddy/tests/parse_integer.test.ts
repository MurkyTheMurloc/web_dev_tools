import { describe, expect, it } from "vitest";

import { parseInteger } from "../src/type_helper.js";

const NUM_1000 = 1000;
const NUM_42 = 42;
const NUM_42_9 = 42.9;

describe(parseInteger, () => {
    it("should parse strict integer-like values", () => {
        expect(parseInteger(NUM_42)).toBe(NUM_42);
        expect(parseInteger(NUM_42_9)).toBe(NUM_42);
        expect(parseInteger("42")).toBe(NUM_42);
        expect(parseInteger(" 42 ")).toBe(NUM_42);
        expect(parseInteger("1e3")).toBe(NUM_1000);
    });

    it("should reject partial or non-integer strings", () => {
        expect(parseInteger("42px")).toBeUndefined();
        expect(parseInteger("4.2")).toBeUndefined();
        expect(parseInteger("Infinity")).toBeUndefined();
    });
});
