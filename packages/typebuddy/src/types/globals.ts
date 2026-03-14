export {};

declare global {
  type Optional<T> = import("./optional.js").Optional<T>;
  type ResolveOptional<T, R extends Optional<T>> = import("./optional.js").ResolveOptional<T, R>;
  type Maybe<T> = import("./maybe.js").Maybe<T>;
  type ResolveMaybe<T, R extends Maybe<T>> = import("./maybe.js").ResolveMaybe<T, R>;
  type Nullable<T> = import("./null_able.js").Nullable<T>;
  type ResolveNullable<T, R extends Nullable<T>> = import("./null_able.js").ResolveNullable<T, R>;
  type MaybePromise<T> = import("./maybe_promise.js").MaybePromise<T>;
  type Success<T> = import("./maybe_promise.js").Success<T>;
  type Failed<T extends null = null> = import("./maybe_promise.js").Failed<T>;
  type JsonifiedValue<T> = import("./json.js").JsonifiedValue<T>;
  type Stringified<T> = import("./json.js").Stringified<T>;

  interface JSON {
    stringify<T>(
      value: T,
      replacer?: null | undefined,
      space?: string | number,
    ): Stringified<T>;

    parse<T>(
      str: Stringified<T>,
      replacer?: null | undefined,
    ): import("./json.js").JsonifiedObject<T>;
  }
}
