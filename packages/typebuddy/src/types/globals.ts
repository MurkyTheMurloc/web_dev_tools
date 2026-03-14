export {};

declare global {
  type Optional<T> = import("./optional.js").Optional<T>;
  type Maybe<T> = import("./maybe.js").Maybe<T>;
  type Nullable<T> = import("./null_able.js").Nullable<T>;
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
