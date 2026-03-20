# TypeBuddy Patterns

Use these patterns when a project standardizes on `@murky-web/typebuddy`.

## Type System

- `Optional<T>` means `T | undefined`
- `Maybe<T>` means `T | null`
- `Nullable<T>` means `T | null | undefined`
- `ResolveOptional<T, R>`, `ResolveMaybe<T, R>`, and `ResolveNullable<T, R>`
  model fallback-driven resolution
- `MaybePromise<T>` is useful when APIs may return sync or async results

## Import Style

Prefer narrow imports so bundlers only pull what is needed:

```ts
import { isString, parseNumber, isNullable } from "@murky-web/typebuddy";
import type { Nullable, Optional } from "@murky-web/typebuddy";
```

Avoid broad helper barrels in local app code when you only need a couple of
functions.

## Guard Patterns

Use primitive guards for unknown values:

```ts
import { isArray, isObject, isString } from "@murky-web/typebuddy";

const input: unknown = payload;

if (!isObject(input)) {
    throw new Error("Expected an object");
}

if (!isString(input.name)) {
    throw new Error("Expected a name");
}
```

Use type-system guards for wrapper types:

```ts
import { isArray, isNullable, isOptional } from "@murky-web/typebuddy";
import type { Nullable, Optional } from "@murky-web/typebuddy";

const title: Optional<string> = maybeTitle;
if (isOptional(title)) {
    return;
}

title.toUpperCase();

const tags: Nullable<string[]> = maybeTags;
if (!isArray(tags)) {
    return;
}

tags.map((tag) => tag.toUpperCase());
```

Keep `isEmptyLike` separate in your head from nullish narrowing:

```ts
import { isEmptyLike, isNullable } from "@murky-web/typebuddy";
```

- `isNullable` is for type-system absence
- `isEmptyLike` is for broad empty-value semantics

Do not swap them casually.

## Parser Patterns

Without a default:

```ts
import { parseInteger, parseNumber, parseString } from "@murky-web/typebuddy";

const count = parseInteger(input.count);
const price = parseNumber(input.price);
const title = parseString(input.title);
```

With a default:

```ts
import { parseArray, parseFloat, parseString } from "@murky-web/typebuddy";

const rating = parseFloat(rawRating, 0);
const label = parseString(rawLabel, "");
const tags = parseArray(rawTags, []);
```

Use the no-default form when the caller should still branch on missing or
invalid input. Use the default form when the caller truly wants a resolved
value.

## Globals Opt-In

Only opt into globals through the dedicated entry:

```ts
import type {} from "@murky-web/typebuddy/globals";
```

That makes the standardized global names available without turning the main
package entry into a global-augmentation trap.

Do not place ad-hoc `declare global` exports in your own normal package entry
when following the typebuddy pattern.

## Tooling Entries

TypeBuddy exposes tooling-specific surfaces:

- `@murky-web/typebuddy/oxlint`
- `@murky-web/typebuddy/biome`
- `@murky-web/typebuddy/globals`

Keep those explicit. If a project uses the rules or globals, wire the dedicated
entry intentionally instead of hiding the behavior in a generic preset.
