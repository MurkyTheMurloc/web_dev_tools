import type { Maybe } from "./maybe.js";
import type { Optional } from "./optional.js";
type Nullable<N> = Optional<N> | Maybe<N>;
type ResolveNullable<T, R extends Nullable<T>> = R extends null | undefined
  ? Nullable<T>
  : T;

export type { Nullable, ResolveNullable };
