import { describe, expect, expectTypeOf, it } from "vitest";

// Importing the entry pulls in the global JSON augmentation, like any consumer.
import type { JsonifiedValue } from "../src/index.js";

interface Payload {
    readonly tags: readonly string[];
    readonly pair: readonly [string, number];
    readonly maybe: readonly (string | undefined)[];
}

describe("JSON.parse(JSON.stringify(...)) types", () => {
    it("keeps arrays as arrays", () => {
        const parsed = JSON.parse(JSON.stringify({ tags: ["a", "b"] }));

        expectTypeOf(parsed.tags).toEqualTypeOf<string[]>();
        expect(parsed.tags.map((tag) => tag.toUpperCase())).toStrictEqual([
            "A",
            "B",
        ]);
    });

    it("keeps a top-level array an array", () => {
        const parsed = JSON.parse(JSON.stringify([1, 2]));

        expectTypeOf(parsed).toEqualTypeOf<number[]>();
        expect(parsed.map((entry) => entry + 1)).toStrictEqual([2, 3]);
    });

    it("keeps tuples as tuples and drops readonly", () => {
        expectTypeOf<JsonifiedValue<Payload>["pair"]>().toEqualTypeOf<
            [string, number]
        >();
        expectTypeOf<JsonifiedValue<Payload>["tags"]>().toEqualTypeOf<
            string[]
        >();
    });

    it("turns array elements JSON cannot hold into null", () => {
        expectTypeOf<JsonifiedValue<Payload>["maybe"]>().toEqualTypeOf<
            (string | null)[]
        >();
        expect(JSON.parse(JSON.stringify([undefined, "a"]))).toStrictEqual([
            null,
            "a",
        ]);
    });

    it("types a Map or Set as the empty object it serialises to", () => {
        expectTypeOf<JsonifiedValue<Map<string, number>>>().toEqualTypeOf<
            Record<string, never>
        >();
        expectTypeOf<JsonifiedValue<Set<string>>>().toEqualTypeOf<
            Record<string, never>
        >();
        expect(JSON.parse(JSON.stringify(new Map([["a", 1]])))).toStrictEqual(
            {},
        );
    });

    it("keeps numbers numbers (NaN and Infinity serialise to null at runtime)", () => {
        expectTypeOf<JsonifiedValue<number>>().toEqualTypeOf<number>();
        expectTypeOf<JsonifiedValue<{ n: number }>>().toEqualTypeOf<{
            n: number;
        }>();
    });

    it("keeps dates as the string toJSON returns", () => {
        expectTypeOf<JsonifiedValue<{ at: Date }>>().toEqualTypeOf<{
            at: string;
        }>();
    });

    it("drops properties JSON drops", () => {
        expectTypeOf<
            JsonifiedValue<{ a: string; b: undefined; c: () => void }>
        >().toEqualTypeOf<{ a: string }>();
    });
});
