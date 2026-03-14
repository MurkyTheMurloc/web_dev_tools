import { describe, expect, it } from "vitest";

import { isEmptyLike } from "../src/type_helper.js";

describe("isEmptyLike", () => {
    it("should return true for empty-like inputs", () => {
        expect(isEmptyLike(null)).toBe(true);
        expect(isEmptyLike(undefined)).toBe(true);
        expect(isEmptyLike("")).toBe(true);
        expect(isEmptyLike("   ")).toBe(true);
        expect(isEmptyLike({})).toBe(true);
        expect(isEmptyLike([])).toBe(true);
        expect(isEmptyLike(false)).toBe(true);
        expect(
            isEmptyLike([
                {
                    test: null,
                },
            ]),
        ).toBe(true);
        expect(
            isEmptyLike([
                {
                    test: undefined,
                },
            ]),
        ).toBe(true);
        expect(
            isEmptyLike([
                {
                    test: [],
                },
            ]),
        ).toBe(true);
        expect(
            isEmptyLike([
                {
                    test: [
                        {
                            test: null,
                        },
                    ],
                },
            ]),
        ).toBe(true);
    });

    it("should return false for non-empty inputs", () => {
        expect(isEmptyLike("Hello")).toBe(false);
        expect(isEmptyLike(123)).toBe(false);
        expect(isEmptyLike(Symbol())).toBe(false);
        expect(isEmptyLike(NaN)).toBe(false);
        expect(isEmptyLike(1)).toBe(false);
        expect(isEmptyLike(0)).toBe(false);
        expect(isEmptyLike(true)).toBe(false);
    });
});
