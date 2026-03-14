import { Optional } from "./optional.ts";
import { Maybe } from "./maybe.ts";
export type Nullable<N> = Optional<N> | Maybe<N>;
