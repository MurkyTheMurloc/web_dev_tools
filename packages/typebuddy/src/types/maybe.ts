export type Maybe<M> = M | null;

export type ResolveMaybe<T, R extends Maybe<T>> = R extends null ? Maybe<T> : T;
