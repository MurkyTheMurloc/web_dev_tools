type ErrorState<T> = T extends null ? true : false;
type Success<T> = {
  isError: ErrorState<T>;
  value: T;
};

type Failed<T extends null = null> = {
  isError: ErrorState<T>;
  value: T;
};

type MaybePromise<T> = Promise<Success<T> | Failed>;

export type { Failed, MaybePromise, Success };
