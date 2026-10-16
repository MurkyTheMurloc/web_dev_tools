import { describe, expect, it } from "vitest";

import { isEmptyString } from "../src/type_helper.js";

const NUM_123 = 123;

describe(isEmptyString, () => {
    it("should return true for empty string inputs", () => {
        expect(isEmptyString("")).toBeTruthy();
    });

    it("should return false for non-empty string inputs", () => {
        expect(isEmptyString("Hello")).toBeFalsy();
        expect(isEmptyString("123")).toBeFalsy();
        expect(isEmptyString(NUM_123)).toBeFalsy();
    });
});
