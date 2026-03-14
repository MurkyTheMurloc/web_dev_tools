import type { Maybe } from "./maybe.js";
import type { Optional } from "./optional.js";
export type Nullable<N> = Optional<N> | Maybe<N>;
export type ResolveNullable<T, R extends Nullable<T>> = R extends null | undefined
  ? Nullable<T>
  : T;
