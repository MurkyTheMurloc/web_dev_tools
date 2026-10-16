import { describe, expect, it } from "vitest";

import { isEmptyLike } from "../src/type_helper.js";

const NUM_0 = 0;
const NUM_1 = 1;
const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isEmptyLike, () => {
    it("should return true for empty-like inputs", () => {
        expect(isEmptyLike(null)).toBeTruthy();
        expect(isEmptyLike(missingValue)).toBeTruthy();
        expect(isEmptyLike("")).toBeTruthy();
        expect(isEmptyLike("   ")).toBeTruthy();
        expect(isEmptyLike({})).toBeTruthy();
        expect(isEmptyLike([])).toBeTruthy();
        expect(isEmptyLike(false)).toBeTruthy();
        expect(
            isEmptyLike([
                {
                    test: null,
                },
            ]),
        ).toBeTruthy();
        expect(
            isEmptyLike([
                {
                    test: undefined,
                },
            ]),
        ).toBeTruthy();
        expect(
            isEmptyLike([
                {
                    test: [],
                },
            ]),
        ).toBeTruthy();
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
        ).toBeTruthy();
    });

    it("should return false for non-empty inputs", () => {
        expect(isEmptyLike("Hello")).toBeFalsy();
        expect(isEmptyLike(NUM_123)).toBeFalsy();
        expect(isEmptyLike(Symbol("test"))).toBeFalsy();
        expect(isEmptyLike(Number.NaN)).toBeFalsy();
        expect(isEmptyLike(NUM_1)).toBeFalsy();
        expect(isEmptyLike(NUM_0)).toBeFalsy();
        expect(isEmptyLike(true)).toBeFalsy();
    });
});
