export type JsonifiedValue<T> = T extends string | number | null | boolean
  ? T
  : T extends { toJSON(): infer R }
  ? R
  : T extends undefined | ((...args: any[]) => any)
  ? never
  : T extends object
  ? JsonifiedObject<T>
  : never;

export type JsonifiedObject<T> = {
  [Key in keyof T as [JsonifiedValue<T[Key]>] extends [never]
    ? never
    : Key]: JsonifiedValue<T[Key]>;
};

// Stringified type for JSON.stringify to return as a string with a source type
export type Stringified<ObjType> = string & { source: ObjType };

// Extend the built-in JSON interface
