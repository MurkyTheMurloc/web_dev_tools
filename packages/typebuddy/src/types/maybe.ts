type Maybe<M> = M | null;
type ResolveMaybe<T, R extends Maybe<T>> = R extends null ? Maybe<T> : T;

export type { Maybe, ResolveMaybe };
