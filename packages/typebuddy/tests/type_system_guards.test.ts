import {
    isMaybe,
    isNullable,
    isOptional,
} from "../src/type_helper.js";
import type {
    Maybe,
    Nullable,
    Optional,
    ResolveMaybe,
    ResolveNullable,
    ResolveOptional,
} from "../src/types/index.js";

describe("type-system guards", () => {
    it("should narrow Optional values after an early return guard", () => {
        const value: Optional<string> = "ready";

        if (isOptional(value)) {
            throw new Error("Optional guard should not match a defined value.");
        }

        const narrowed: string = value;
        const resolved: ResolveOptional<string, typeof value> = narrowed;

        expect(narrowed).toBe("ready");
        expect(resolved).toBe("ready");
    });

    it("should narrow Maybe values after an early return guard", () => {
        const value: Maybe<string> = "ready";

        if (isMaybe(value)) {
            throw new Error("Maybe guard should not match a defined value.");
        }

        const narrowed: string = value;
        const resolved: ResolveMaybe<string, typeof value> = narrowed;

        expect(narrowed).toBe("ready");
        expect(resolved).toBe("ready");
    });

    it("should narrow Nullable values after an early return guard", () => {
        const value: Nullable<string> = "ready";

        if (isNullable(value)) {
            throw new Error("Nullable guard should not match a defined value.");
        }

        const narrowed: string = value;
        const resolved: ResolveNullable<string, typeof value> = narrowed;

        expect(narrowed).toBe("ready");
        expect(resolved).toBe("ready");
    });

    it("should detect the missing states directly", () => {
        const optionalValue: Optional<string> = undefined;
        const maybeValue: Maybe<string> = null;
        const nullableUndefined: Nullable<string> = undefined;
        const nullableNull: Nullable<string> = null;

        expect(isOptional(optionalValue)).toBe(true);
        expect(isMaybe(maybeValue)).toBe(true);
        expect(isNullable(nullableUndefined)).toBe(true);
        expect(isNullable(nullableNull)).toBe(true);
    });
});
