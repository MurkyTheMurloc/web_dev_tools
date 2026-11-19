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

    it("should not overflow the stack on a self-referencing object", () => {
        const cyclic: Record<string, unknown> = { note: "" };
        cyclic["self"] = cyclic;

        expect(isEmptyLike(cyclic)).toBeTruthy();
    });

    it("should not overflow the stack on a self-referencing array", () => {
        const cyclic: unknown[] = [null];
        cyclic.push(cyclic);

        expect(isEmptyLike(cyclic)).toBeTruthy();
    });

    it("should not overflow the stack on a cycle through two objects", () => {
        const first: Record<string, unknown> = {};
        const second: Record<string, unknown> = { first };
        first["second"] = second;

        expect(isEmptyLike(first)).toBeTruthy();
    });

    it("should still find content in a self-referencing object", () => {
        const cyclic: Record<string, unknown> = { name: "murky" };
        cyclic["self"] = cyclic;

        expect(isEmptyLike(cyclic)).toBeFalsy();
    });

    it("should not mistake a repeated, non-cyclic reference for a cycle", () => {
        const shared = { value: "x" };

        expect(isEmptyLike([shared, shared])).toBeFalsy();
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
