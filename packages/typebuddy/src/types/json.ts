type UnknownFunction = (...args: readonly unknown[]) => unknown;

type JsonifiedValue<T> = T extends string | number | null | boolean
  ? T
  : T extends { toJSON(): infer R }
  ? R
  : T extends undefined | UnknownFunction
  ? never
  : T extends object
  ? JsonifiedObject<T>
  : never;

type JsonifiedObject<T> = {
  [Key in keyof T as [JsonifiedValue<T[Key]>] extends [never]
    ? never
    : Key]: JsonifiedValue<T[Key]>;
};

// Stringified type for JSON.stringify to return as a string with a source type
type Stringified<ObjType> = string & { source: ObjType };

export type { JsonifiedObject, JsonifiedValue, Stringified };
