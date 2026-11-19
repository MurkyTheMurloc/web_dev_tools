import { describe, expect, expectTypeOf, it } from "vitest";

import { parseArray } from "../src/type_helper.js";

describe(parseArray, () => {
    it("should wrap a plain object in an array, not only an empty one", () => {
        expect(parseArray({ a: 1 })).toStrictEqual([{ a: 1 }]);
        expect(parseArray({})).toStrictEqual([{}]);
    });

    it("should keep the default for objects that are not plain", () => {
        expect(parseArray(new Date(0), ["fallback"])).toStrictEqual([
            "fallback",
        ]);
        expect(parseArray(new Map(), ["fallback"])).toStrictEqual(["fallback"]);
    });

    it("should type a finite-number-only result as possibly missing", () => {
        // `parseArray(NaN)` has no array to give: the type has to say so.
        expectTypeOf(parseArray(1)).toEqualTypeOf<number[] | undefined>();
        expect(parseArray(1)).toStrictEqual([1]);
        expect(parseArray(Number.NaN)).toBeUndefined();
        expect(parseArray(Infinity)).toBeUndefined();
    });

    it("should type arrays, strings and objects as arrays", () => {
        expectTypeOf(parseArray(["a"])).toEqualTypeOf<string[]>();
        expectTypeOf(parseArray("a,b")).toEqualTypeOf<string[]>();
        expectTypeOf(parseArray({ a: 1 })).toEqualTypeOf<{ a: number }[]>();
    });

    it("should use the default for a number it cannot parse", () => {
        expect(parseArray(Number.NaN, [0])).toStrictEqual([0]);
    });
});
