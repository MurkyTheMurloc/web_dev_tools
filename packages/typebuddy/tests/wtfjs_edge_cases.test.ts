import {
    isMaybe,
    isNullable,
    isNumber,
    isOptional,
    isObject,
    parseFloat,
    parseInteger,
    parseNumber,
} from "../src/type_helper.js";

describe("wtfjs-inspired edge cases", () => {
    it("should reject coercion traps for isNumber", () => {
        expect(isNumber(NaN)).toBe(false);
        expect(isNumber(Infinity)).toBe(false);
        expect(isNumber(-Infinity)).toBe(false);
        expect(isNumber(Number(" "))).toBe(true);
        expect(isNumber(Number([]))).toBe(true);
        expect(isNumber(new Number(1))).toBe(false);
    });

    it("should keep the type-system guards aligned with their missing states", () => {
        expect(isOptional(undefined)).toBe(true);
        expect(isMaybe(null)).toBe(true);
        expect(isNullable(undefined)).toBe(true);
        expect(isNullable(null)).toBe(true);
    });

    it("should only treat plain objects as objects", () => {
        expect(isObject(new Date())).toBe(false);
        expect(isObject(/wtf/)).toBe(false);
        expect(isObject(Promise.resolve("value"))).toBe(false);
        expect(isObject(Object.create(null))).toBe(false);
        expect(isObject(new Number(1))).toBe(false);
    });

    it("should parse integers with explicit base-10 semantics", () => {
        expect(parseInteger("08")).toBe(8);
        expect(parseInteger("015")).toBe(15);
        expect(parseInteger("0e0")).toBe(0);
        expect(parseInteger("12px")).toBeUndefined();
        expect(parseInteger("12.5")).toBeUndefined();
    });

    it("should parse float-like strings with dot and comma decimals", () => {
        expect(parseFloat("1.5")).toBe(1.5);
        expect(parseFloat("1,5")).toBe(1.5);
        expect(parseFloat("0.1")).toBe(0.1);
    });

    it("should route decimal strings through parseNumber correctly", () => {
        expect(parseNumber("1.5")).toBe(1.5);
        expect(parseNumber("1,5")).toBe(1.5);
        expect(parseNumber("08")).toBe(8);
        expect(parseNumber("1e3")).toBe(1000);
        expect(parseNumber("0xff")).toBe(255);
        expect(parseNumber("0b10")).toBe(2);
        expect(parseNumber(" 42 ")).toBe(42);
        expect(parseNumber("Infinity")).toBeUndefined();
    });
});
