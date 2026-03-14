import { describe, expect, it } from "vitest";

import { hasEmptyValues, parseArray } from "../src/type_helper.js";

describe("json and array edge cases", () => {
    it("should not throw on non-json strings in hasEmptyValues", () => {
        expect(hasEmptyValues("not-json")).toBe(false);
        expect(hasEmptyValues("")).toBe(true);
        expect(hasEmptyValues("   ")).toBe(true);
    });

    it("should treat empty JSON objects as empty values", () => {
        expect(hasEmptyValues("{}")).toBe(true);
        expect(hasEmptyValues('{"value":1}')).toBe(false);
        expect(hasEmptyValues("[]")).toBe(false);
    });

    it("should split parseArray strings without empty artifacts", () => {
        expect(parseArray("a,b,c")).toEqual(["a", "b", "c"]);
        expect(parseArray("a, b; c|d")).toEqual(["a", "b", "c", "d"]);
        expect(parseArray(" a  b \n c\t")).toEqual(["a", "b", "c"]);
        expect(parseArray(",,a,,")).toEqual(["a"]);
    });

    it("should keep parseArray defaults for nullish and unparsable values", () => {
        expect(parseArray(null, ["fallback"])).toEqual(["fallback"]);
        expect(parseArray(undefined, ["fallback"])).toEqual(["fallback"]);
        expect(parseArray(Symbol("x"), ["fallback"])).toEqual(["fallback"]);
    });
});
