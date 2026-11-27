import type {
    Brand as BrandImport,
    NonEmptyString as NonEmptyStringImport,
    UlidString as UlidStringImport,
    UuidString as UuidStringImport
} from "./src/types/brand.js";
import type {
    JsonifiedValue as JsonifiedValueImport,
    Stringified as StringifiedImport
} from "./src/types/json.js";
import type {
    Maybe as MaybeImport,
    ResolveMaybe as ResolveMaybeImport
} from "./src/types/maybe.js";
import type {
    AsyncResult as AsyncResultImport,
    Failed as FailedImport,
    MaybePromise as MaybePromiseImport,
    Result as ResultImport,
    Success as SuccessImport,
    TaggedError as TaggedErrorImport
} from "./src/types/maybe_promise.js";
import type {
    Nullable as NullableImport,
    ResolveNullable as ResolveNullableImport
} from "./src/types/nullable.js";
import type {
    Optional as OptionalImport,
    ResolveOptional as ResolveOptionalImport
} from "./src/types/optional.js";

declare global {
    type AsyncResult<T, E = null> = AsyncResultImport<T, E>;
    type Brand<T, Tag extends string> = BrandImport<T, Tag>;
    type Failed<E = null> = FailedImport<E>;
    type JsonifiedValue<T> = JsonifiedValueImport<T>;
    type Maybe<T> = MaybeImport<T>;
    type MaybePromise<T, E = null> = MaybePromiseImport<T, E>;
    type NonEmptyString = NonEmptyStringImport;
    type Nullable<T> = NullableImport<T>;
    type Optional<T> = OptionalImport<T>;
    type ResolveMaybe<T, R extends Maybe<T>> = ResolveMaybeImport<T, R>;
    type ResolveNullable<T, R extends Nullable<T>> = ResolveNullableImport<
        T,
        R
    >;
    type ResolveOptional<T, R extends Optional<T>> = ResolveOptionalImport<
        T,
        R
    >;
    type Result<T, E = null> = ResultImport<T, E>;
    type Stringified<T> = StringifiedImport<T>;
    type Success<T> = SuccessImport<T>;
    type TaggedError<
        Tag extends string,
        Fields extends Readonly<Record<string, unknown>> | undefined = undefined
    > = TaggedErrorImport<Tag, Fields>;
    type UlidString = UlidStringImport;
    type UuidString = UuidStringImport;

    interface JSON {
        stringify<T>(
            value: T,
            replacer?: null,
            space?: string | number
        ): Stringified<T>;

        parse<T>(str: Stringified<T>, replacer?: null): JsonifiedValueImport<T>;
    }
}

export type {
    AsyncResultImport as AsyncResult,
    BrandImport as Brand,
    FailedImport as Failed,
    JsonifiedValueImport as JsonifiedValue,
    MaybeImport as Maybe,
    MaybePromiseImport as MaybePromise,
    NonEmptyStringImport as NonEmptyString,
    NullableImport as Nullable,
    OptionalImport as Optional,
    ResolveMaybeImport as ResolveMaybe,
    ResolveNullableImport as ResolveNullable,
    ResolveOptionalImport as ResolveOptional,
    ResultImport as Result,
    StringifiedImport as Stringified,
    SuccessImport as Success,
    TaggedErrorImport as TaggedError,
    UlidStringImport as UlidString,
    UuidStringImport as UuidString
};
