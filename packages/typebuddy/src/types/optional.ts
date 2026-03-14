type Optional<T> = T | undefined;

type ResolveOptionalArray<T, R extends Optional<T>> = R extends undefined
  ? Optional<T>
  : T;

type ResolveBasicOptional<T, R extends Optional<T>> = R extends undefined
  ? Optional<T>
  : T;

type ResolveOptional<T, R extends Optional<T>> = T extends Array<unknown>
  ? ResolveOptionalArray<T, R>
  : ResolveBasicOptional<T, R>;

export { Optional, ResolveOptional };
