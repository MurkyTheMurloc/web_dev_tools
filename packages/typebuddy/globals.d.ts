import type {
  JsonifiedObject as JsonifiedObjectImport,
  JsonifiedValue as JsonifiedValueImport,
  Stringified as StringifiedImport,
} from "./src/types/json.js";
import type { Maybe as MaybeImport, ResolveMaybe as ResolveMaybeImport } from "./src/types/maybe.js";
import type {
  Failed as FailedImport,
  MaybePromise as MaybePromiseImport,
  Success as SuccessImport,
} from "./src/types/maybe_promise.js";
import type {
  Nullable as NullableImport,
  ResolveNullable as ResolveNullableImport,
} from "./src/types/nullable.js";
import type {
  Optional as OptionalImport,
  ResolveOptional as ResolveOptionalImport,
} from "./src/types/optional.js";

declare global {
  type Failed<T extends null = null> = FailedImport<T>;
  type JsonifiedValue<T> = JsonifiedValueImport<T>;
  type Maybe<T> = MaybeImport<T>;
  type MaybePromise<T> = MaybePromiseImport<T>;
  type Nullable<T> = NullableImport<T>;
  type Optional<T> = OptionalImport<T>;
  type ResolveMaybe<T, R extends Maybe<T>> = ResolveMaybeImport<T, R>;
  type ResolveNullable<T, R extends Nullable<T>> = ResolveNullableImport<T, R>;
  type ResolveOptional<T, R extends Optional<T>> = ResolveOptionalImport<T, R>;
  type Stringified<T> = StringifiedImport<T>;
  type Success<T> = SuccessImport<T>;

  interface JSON {
    stringify<T>(
      value: T,
      replacer?: null,
      space?: string | number,
    ): Stringified<T>;

    parse<T>(
      str: Stringified<T>,
      replacer?: null,
    ): JsonifiedObjectImport<T>;
  }
}

export {};
