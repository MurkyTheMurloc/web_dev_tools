import type { Failed, MaybePromise, Success } from "./maybe_promise.js";
import type { JsonifiedObject, JsonifiedValue, Stringified } from "./json.js";
import type { Maybe } from "./maybe.js";
import type { Nullable } from "./null_able.js";
import type { Optional } from "./optional.js";

interface JSON {
  stringify<T>(
    value: T,
    replacer?: null | undefined,
    space?: string | number,
  ): Stringified<T>;

  parse<T>(
    str: Stringified<T>,
    replacer?: null | undefined,
  ): JsonifiedObject<T>;
}

export type {
  JSON,
  Optional,
  Maybe,
  Nullable,
  MaybePromise,
  Success,
  Failed,
  JsonifiedValue,
  Stringified,
};
