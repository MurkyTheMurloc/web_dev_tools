import type { Maybe } from "./maybe.js";
import type { Optional } from "./optional.js";
export type Nullable<N> = Optional<N> | Maybe<N>;
