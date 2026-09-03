// Side-effect type import: pulls the `declare global` block into any
// program that imports this package, so the global helpers need no
// tsconfig entry of their own.
import type {} from "../globals.js";

export * from "./type_helper.js";

export type {
  Failed,
  JsonifiedObject,
  JsonifiedValue,
  Maybe,
  MaybePromise,
  Nullable,
  Optional,
  ResolveMaybe,
  ResolveNullable,
  ResolveOptional,
  Stringified,
  Success,
} from "./types/index.js";
