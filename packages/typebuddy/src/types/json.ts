type UnknownFunction = (...args: readonly unknown[]) => unknown;

/** What `JSON.stringify` serialises to `{}`: it has no enumerable own data. */
type EmptyJsonObject = Record<string, never>;

/**
 * Array and tuple elements JSON cannot hold become `null` instead of vanishing
 * (`JSON.stringify([undefined])` is `"[null]"`), so the element type keeps a
 * `null` where an object property would be dropped.
 */
type JsonifiedElement<T> = T extends undefined | symbol | UnknownFunction
    ? null
    : JsonifiedValue<T>;

/**
 * Arrays and tuples are mapped element by element with a plain homomorphic
 * mapped type, which keeps them arrays and tuples. `JsonifiedObject` cannot do
 * this: its key remapping turns an array into an object type without `map`. The
 * result is mutable, because `JSON.parse` builds fresh arrays.
 */
type JsonifiedArray<T extends readonly unknown[]> = {
    -readonly [Index in keyof T]: JsonifiedElement<T[Index]>;
};

/**
 * The type `JSON.parse` gives back for a value that went through
 * `JSON.stringify`.
 *
 * `number` stays `number`: the type system has no way to say "not NaN or
 * Infinity", and `JSON.stringify` turns those two into `null` at runtime.
 */
type JsonifiedValue<T> = T extends string | number | null | boolean
    ? T
    : T extends { toJSON: () => infer R }
      ? R
      : T extends undefined | symbol | UnknownFunction
        ? never
        : T extends readonly unknown[]
          ? JsonifiedArray<T>
          : T extends
                  | ReadonlyMap<unknown, unknown>
                  | ReadonlySet<unknown>
                  | WeakMap<WeakKey, unknown>
                  | WeakSet<WeakKey>
            ? EmptyJsonObject
            : T extends object
              ? JsonifiedObject<T>
              : never;

type JsonifiedObject<T> = {
    [
        Key in keyof T as [JsonifiedValue<T[Key]>] extends [never] ? never : Key
    ]: JsonifiedValue<T[Key]>;
};

// Stringified type for JSON.stringify to return as a string with a source type
type Stringified<ObjType> = string & { source: ObjType };

export type { JsonifiedObject, JsonifiedValue, Stringified };
