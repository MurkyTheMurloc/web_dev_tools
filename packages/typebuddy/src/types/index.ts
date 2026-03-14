import type { Optional } from "./optional.ts";
import type { Maybe } from "./maybe.ts";
import type { Nullable } from "./null_able.ts";
import type { Failed, MaybePromise, Success } from "./maybe_promise.ts";
import type { JsonifiedObject, Stringified, JsonifiedValue } from "./json.ts";
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

export {
  JSON,
  Optional,
  Maybe,
  Nullable,
  MaybePromise,
  Success,
  Failed,
  JsonifiedValue,
  JsonifiedValue,
  Stringified,
};
