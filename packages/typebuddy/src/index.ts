// Side-effect type import: pulls the `declare global` block into any
// program that imports this package, so the global helpers need no
// tsconfig entry of their own. The empty brace form is the only way to say
// "load this module for its ambient declarations" without importing a value,
// and `globals.ts` sits at the package root because it is a published entry
// point (`@murky-web/typebuddy/globals`).
// oxlint-disable-next-line no-empty-named-blocks, no-relative-parent-imports, require-module-specifiers
import type {} from "../globals.js";

export * from "./type_helper.js";

export type {
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
  Stringified,
  Success,
} from "./types/index.js";
