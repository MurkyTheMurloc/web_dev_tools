import { describe, expect, it } from "vitest";

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

const NUM_0 = 0;
const NUM_0_1 = 0.1;
const NUM_1 = 1;
const NUM_1000 = 1000;
const NUM_15 = 15;
const NUM_1_5 = 1.5;
const NUM_2 = 2;
const NUM_255 = 255;
const NUM_42 = 42;
const NUM_8 = 8;

const missingValue: unknown = undefined;

describe("wtfjs-inspired edge cases", () => {
    it("should reject coercion traps for isNumber", () => {
        expect(isNumber(Number.NaN)).toBeFalsy();
        expect(isNumber(Infinity)).toBeFalsy();
        expect(isNumber(-Infinity)).toBeFalsy();
        expect(isNumber(Number(" "))).toBeTruthy();
        expect(isNumber(Number([]))).toBeTruthy();
        expect(isNumber(new Object(NUM_1))).toBeFalsy();
    });

    it("should keep the type-system guards aligned with their missing states", () => {
        expect(isOptional(missingValue)).toBeTruthy();
        expect(isMaybe(null)).toBeTruthy();
        expect(isNullable(missingValue)).toBeTruthy();
        expect(isNullable(null)).toBeTruthy();
    });

    it("should only treat plain objects as objects", () => {
        expect(isObject(new Date())).toBeFalsy();
        expect(isObject(/wtf/)).toBeFalsy();
        expect(isObject(Promise.resolve("value"))).toBeFalsy();
        expect(isObject(Object.create(null))).toBeFalsy();
        expect(isObject(new Object(NUM_1))).toBeFalsy();
    });

    it("should parse integers with explicit base-10 semantics", () => {
        expect(parseInteger("08")).toBe(NUM_8);
        expect(parseInteger("015")).toBe(NUM_15);
        expect(parseInteger("0e0")).toBe(NUM_0);
        expect(parseInteger("12px")).toBeUndefined();
        expect(parseInteger("12.5")).toBeUndefined();
    });

    it("should parse float-like strings with dot and comma decimals", () => {
        expect(parseFloat("1.5")).toBe(NUM_1_5);
        expect(parseFloat("1,5")).toBe(NUM_1_5);
        expect(parseFloat("0.1")).toBe(NUM_0_1);
    });

    it("should route decimal strings through parseNumber correctly", () => {
        expect(parseNumber("1.5")).toBe(NUM_1_5);
        expect(parseNumber("1,5")).toBe(NUM_1_5);
        expect(parseNumber("08")).toBe(NUM_8);
        expect(parseNumber("1e3")).toBe(NUM_1000);
        expect(parseNumber("0xff")).toBe(NUM_255);
        expect(parseNumber("0b10")).toBe(NUM_2);
        expect(parseNumber(" 42 ")).toBe(NUM_42);
        expect(parseNumber("Infinity")).toBeUndefined();
    });
});
