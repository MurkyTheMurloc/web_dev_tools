/**
 * Nominal branding without runtime cost. A branded value stays assignable to
 * its underlying primitive (`UuidString` is a `string`), while plain primitives
 * and differently branded values are rejected where the brand is expected.
 */

declare const brandSymbol: unique symbol;

/** Tags a type `T` with a compile-time marker `Tag`. Zero runtime overhead. */
type Brand<T, Tag extends string> = T & { readonly [brandSymbol]: Tag };

/** A string validated as an RFC 9562 UUID (versions 1–8, nil or max). */
type UuidString = Brand<string, "UuidString">;

/** A string validated as a Crockford base32 ULID. */
type UlidString = Brand<string, "UlidString">;

/** A string that contains at least one non-whitespace character. */
type NonEmptyString = Brand<string, "NonEmptyString">;

export type { Brand, NonEmptyString, UlidString, UuidString };
