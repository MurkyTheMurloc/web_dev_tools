import { describe, expect, expectTypeOf, it } from "vitest";

import {
    fastIsArray,
    isFloat,
    isInteger,
    isNumber,
    isPromise
} from "../src/type_helper.js";
import type {
    FiniteNumber,
    FloatNumber,
    IntegerNumber
} from "../src/type_helper.js";

describe("the brand in inferred types", () => {
    it("should spread into the element type of a filtered array", () => {
        const mixed = [1, null, 2];
        const filtered = mixed.filter(isNumber);

        expectTypeOf(filtered).toEqualTypeOf<FiniteNumber[]>();
        expect(filtered).toStrictEqual([1, 2]);
    });

    it("should widen with an annotation, so push accepts a plain number", () => {
        const widened: number[] = [1, null].filter(isNumber);
        widened.push(3);

        expect(widened).toStrictEqual([1, 3]);
    });
});

describe("isInteger and isFloat narrowing", () => {
    it("should keep a number | null a number | null in the false branch of isInteger", () => {
        const load = (): number | null => {
            return 1.5;
        };
        const value = load();

        if (isInteger(value)) {
            throw new Error("1.5 is not an integer.");
        }

        expectTypeOf(value).toEqualTypeOf<number | null>();
        expect(value).toBe(1.5);
    });

    it("should keep a number | null a number | null in the false branch of isFloat", () => {
        const load = (): number | null => {
            return 2;
        };
        const value = load();

        if (isFloat(value)) {
            throw new Error("2 is not a float.");
        }

        expectTypeOf(value).toEqualTypeOf<number | null>();
        expect(value).toBe(2);
    });

    it("should narrow the true branch to a number brand", () => {
        const load = (input: number): number | null => {
            return input;
        };
        const whole = load(3);
        const fraction = load(2.5);

        if (!isInteger(whole) || !isFloat(fraction)) {
            throw new Error("Expected an integer and a float.");
        }

        expectTypeOf(whole).toEqualTypeOf<IntegerNumber>();
        expectTypeOf(fraction).toEqualTypeOf<FloatNumber>();
        expectTypeOf(whole).toExtend<number>();
        expectTypeOf(fraction).toExtend<number>();
    });

    it("should keep the runtime answers", () => {
        expect(isInteger(3)).toBeTruthy();
        expect(isInteger(3.5)).toBeFalsy();
        expect(isInteger(Number.NaN)).toBeFalsy();
        expect(isFloat(3.5)).toBeTruthy();
        expect(isFloat(3)).toBeFalsy();
    });
});

describe("isNumber narrowing", () => {
    it("should not narrow a number | null away in the false branch", () => {
        const load = (): number | null => {
            return Number.NaN;
        };
        const value = load();

        if (isNumber(value)) {
            throw new Error("NaN is not a finite number.");
        }

        // NaN is a `number` that fails the guard, so `null` alone is wrong.
        expectTypeOf(value).toEqualTypeOf<number | null>();
        expect(Number.isNaN(value)).toBeTruthy();
    });

    it("should narrow a number | null to a finite number in the true branch", () => {
        const load = (): number | null => {
            return 1;
        };
        const value = load();

        if (!isNumber(value)) {
            throw new Error("Expected a finite number.");
        }

        expectTypeOf(value).toEqualTypeOf<FiniteNumber>();
        expectTypeOf(value).toExtend<number>();
    });

    it("should keep a numeric literal through the guard", () => {
        const ONE = 1;
        const value: typeof ONE | null = ONE;

        if (!isNumber(value)) {
            throw new Error("Expected a number literal.");
        }

        expectTypeOf(value).toExtend<typeof ONE>();
    });
});

describe(isFloat, () => {
    it("should reject Infinity, like isNumber", () => {
        expect(isFloat(Infinity)).toBeFalsy();
        expect(isFloat(-Infinity)).toBeFalsy();
        expect(isNumber(Infinity)).toBeFalsy();
    });
});

describe(fastIsArray, () => {
    it("should not be fooled by a Symbol.toStringTag", () => {
        expect(fastIsArray({ [Symbol.toStringTag]: "Array" })).toBeFalsy();
    });

    it("should accept real arrays", () => {
        expect(fastIsArray([])).toBeTruthy();
        expect(fastIsArray([1, 2])).toBeTruthy();
        expect(fastIsArray("abc")).toBeFalsy();
    });
});

describe("isPromise edge cases", () => {
    it("should accept a callable thenable", () => {
        const thenable = Object.assign(
            () => {
                // intentionally empty
            },
            {
                then: () => undefined
            }
        );

        expect(isPromise(thenable)).toBeTruthy();
    });

    it("should reject a plain function", () => {
        expect(
            isPromise(() => {
                // intentionally empty
            })
        ).toBeFalsy();
    });

    it("should answer false when reading then throws", () => {
        const hostile = {
            get then(): never {
                throw new Error("then getter blew up");
            }
        };

        expect(isPromise(hostile)).toBeFalsy();
    });

    it("should answer false for a revoked Proxy", () => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();

        expect(isPromise(proxy)).toBeFalsy();
    });
});
