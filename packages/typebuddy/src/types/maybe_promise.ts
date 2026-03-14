export type Error<T> = T extends null ? true : false;
type IsVoid<V> = V extends void ? undefined : V;
export type Success<T> = { value: IsVoid<T>; isError: Error<T> };
export type Failed<T extends null = null> = { value: T; isError: Error<T> };

export type MaybePromise<T> = Promise<Success<T> | Failed>;
