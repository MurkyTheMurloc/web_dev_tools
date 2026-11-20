import { describe, expect, it } from "vitest";

import { parseFloat, parseInteger, parseNumber } from "../src/type_helper.js";

const FALLBACK = 7;

describe("number parsing, second round", () => {
    it("should read a comma after a lone zero as a decimal, not a thousands group", () => {
        expect(parseFloat("0,500")).toBe(0.5);
        expect(parseFloat("0,125")).toBe(0.125);
        expect(parseNumber("0,500")).toBe(0.5);
        expect(parseNumber("-0,125")).toBe(-0.125);
    });

    it("should still refuse a thousands group", () => {
        expect(parseFloat("1,000", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("999,999", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("10,500", FALLBACK)).toBe(FALLBACK);
    });

    it("should turn minus zero into zero in every parser", () => {
        expect(Object.is(parseFloat("-0"), 0)).toBeTruthy();
        expect(Object.is(parseFloat("-0,0"), 0)).toBeTruthy();
        expect(Object.is(parseFloat(-0), 0)).toBeTruthy();
        expect(Object.is(parseNumber("-0"), 0)).toBeTruthy();
        expect(Object.is(parseNumber(-0), 0)).toBeTruthy();
        expect(Object.is(parseInteger("-0"), 0)).toBeTruthy();
    });

    it("should refuse integers a double cannot hold exactly", () => {
        expect(parseInteger("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
        expect(parseInteger("-9007199254740991")).toBe(Number.MIN_SAFE_INTEGER);
        expect(parseInteger("9007199254740993", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("123456789012345678901234567890")).toBeUndefined();
    });

    it("should refuse numbers past the safe integer range, like strings", () => {
        expect(parseInteger(Number.MAX_SAFE_INTEGER)).toBe(
            Number.MAX_SAFE_INTEGER
        );
        expect(parseInteger(2 ** 53, FALLBACK)).toBe(FALLBACK);
        expect(parseInteger(1e21, FALLBACK)).toBe(FALLBACK);
        expect(parseInteger(-1e300)).toBeUndefined();
        expect(parseInteger(Number.MAX_SAFE_INTEGER + 0.5)).toBeUndefined();
    });
});

describe("parseInteger", () => {
    it("should return the default for empty and whitespace strings", () => {
        expect(parseInteger("", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("   ", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("\n\t", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("")).toBeUndefined();
    });

    it("should only accept digits for the whole string", () => {
        expect(parseInteger("12abc", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("abc12", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("0x10", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("0b10", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("1e3", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("1_000", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("1,000", FALLBACK)).toBe(FALLBACK);
        expect(parseInteger("Infinity", FALLBACK)).toBe(FALLBACK);
    });

    it("should accept signs, padding and a zero-only fraction", () => {
        expect(parseInteger("+5")).toBe(5);
        expect(parseInteger("-5")).toBe(-5);
        expect(parseInteger(" 007 ")).toBe(7);
        expect(parseInteger("42.0")).toBe(42);
        expect(parseInteger("42.5", FALLBACK)).toBe(FALLBACK);
    });

    it("should truncate numbers toward zero", () => {
        expect(parseInteger(-1.5)).toBe(-1);
        expect(parseInteger(1.9)).toBe(1);
        expect(parseInteger(-0.5)).toBe(0);
        expect(Object.is(parseInteger(-0.5), 0)).toBeTruthy();
    });

    it("should return the default for numbers that are not finite", () => {
        expect(parseInteger(Number.NaN, FALLBACK)).toBe(FALLBACK);
        expect(parseInteger(Infinity, FALLBACK)).toBe(FALLBACK);
    });
});

describe("parseFloat", () => {
    it("should return the default for empty and whitespace strings", () => {
        expect(parseFloat("", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("  ", FALLBACK)).toBe(FALLBACK);
    });

    it("should validate the whole string", () => {
        expect(parseFloat("12abc", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1.5px", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("0x10", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("Infinity", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1e999", FALLBACK)).toBe(FALLBACK);
    });

    it("should accept decimal notation, with or without an exponent", () => {
        expect(parseFloat("1.5")).toBe(1.5);
        expect(parseFloat(".5")).toBe(0.5);
        expect(parseFloat("-1.25")).toBe(-1.25);
        expect(parseFloat("1.5e2")).toBe(150);
        expect(parseFloat(" 42 ")).toBe(42);
    });

    it("should accept a comma only as the sole decimal separator", () => {
        expect(parseFloat("1,5")).toBe(1.5);
        expect(parseFloat("0,25")).toBe(0.25);
        expect(parseFloat("1,2345")).toBe(1.2345);
        expect(parseFloat("-3,5")).toBe(-3.5);
    });

    it("should reject mixed and grouped forms", () => {
        expect(parseFloat("1,234.56", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1.234,56", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1,000", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("12,345", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1,2,3", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1.2.3", FALLBACK)).toBe(FALLBACK);
        expect(parseFloat("1,", FALLBACK)).toBe(FALLBACK);
    });
});

describe("parseNumber", () => {
    it("should return the default for empty and whitespace strings", () => {
        expect(parseNumber("", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber(" ", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("\n", FALLBACK)).toBe(FALLBACK);
    });

    it("should validate the whole string", () => {
        expect(parseNumber("12abc", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("1 2", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("Infinity", FALLBACK)).toBe(FALLBACK);
    });

    it("should keep everything Number() accepts for a whole string", () => {
        expect(parseNumber("1e3")).toBe(1000);
        expect(parseNumber("0xff")).toBe(255);
        expect(parseNumber("0b10")).toBe(2);
        expect(parseNumber(" 42 ")).toBe(42);
    });

    it("should accept a comma only as the sole decimal separator", () => {
        expect(parseNumber("1,5")).toBe(1.5);
        expect(parseNumber("0,25")).toBe(0.25);
    });

    it("should reject mixed and grouped forms", () => {
        expect(parseNumber("1,000", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("1,234.56", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("1.234,56", FALLBACK)).toBe(FALLBACK);
        expect(parseNumber("1,2,3", FALLBACK)).toBe(FALLBACK);
    });
});
