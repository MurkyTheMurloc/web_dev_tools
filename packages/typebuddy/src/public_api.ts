// Everything the root entry exports, without the global type augmentation.
// `index.ts` adds the augmentation on top of this file for npm; JSR publishes
// this file as its root export, because JSR rejects `declare global`.

export * from "./type_helper.js";

export type {
    AsyncResult,
    Failed,
    JsonifiedObject,
    JsonifiedValue,
    Maybe,
    MaybePromise,
    Nullable,
    Optional,
    ResolveMaybe,
    ResolveNullable,
    ResolveOptional,
    Result,
    Stringified,
    Success
} from "./types/index.js";
