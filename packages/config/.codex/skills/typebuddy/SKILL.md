---
name: typebuddy
description:
    Use @murky-web/typebuddy for TypeScript-first utility types, runtime guards,
    parser helpers, global type opt-in, and typebuddy-specific linting
    integration. Use when working in a codebase that uses typebuddy or when
    introducing Optional, Maybe, Nullable, or type-system-aware guards.
---

# TypeBuddy

Use this skill when working with `@murky-web/typebuddy` or when introducing it
into a TypeScript codebase.

Read [typebuddy-patterns.md](references/typebuddy-patterns.md) when you need the
concrete import patterns, guard examples, parser behavior, and tooling
entrypoints.

## Default Approach

- Keep runtime semantics and type semantics aligned.
- Prefer `typebuddy` guards over ad-hoc checks when the codebase already uses
  `Optional`, `Maybe`, or `Nullable`.
- Use primitive guards for raw JavaScript values and type-system guards for the
  `typebuddy` wrappers.
- Keep imports tree-shake-friendly by importing only the helpers and types you
  actually use.
- Treat global types as explicit opt-in, not ambient magic.

## Core Rules

- Use `Optional<T>` for `T | undefined`.
- Use `Maybe<T>` for `T | null`.
- Use `Nullable<T>` for `T | null | undefined`.
- Use `isOptional`, `isMaybe`, and `isNullable` for early-return narrowing that
  mirrors the type system.
- Keep `isUndefined` and `isNull` for raw JavaScript semantics.
- Use `isEmptyLike` only when you really mean empty-like semantics, not as a
  nullish type guard.
- Parser helpers are honest:
    - without a default value they return an optional result
    - with a default value they return a concrete value
- Do not put `declare global` into a normal package entry. Use the dedicated
  `@murky-web/typebuddy/globals` opt-in entry instead.
- When using the typebuddy lint surface, wire the dedicated
  `@murky-web/typebuddy/oxlint` or `@murky-web/typebuddy/biome` entries
  explicitly.

## Workflow

### 1. Choose the right wrapper type

Before writing helpers or component props, decide whether absence means:

- `undefined` -> `Optional<T>`
- `null` -> `Maybe<T>`
- either one -> `Nullable<T>`

Do not mix them casually. The whole point is to make absence semantics visible
in the type system.

### 2. Match the guard to the type

Use the narrowest guard that matches the type you chose.

- raw JS unknown -> `isString`, `isNumber`, `isArray`, `isObject`
- `Optional<T>` -> `isOptional`
- `Maybe<T>` -> `isMaybe`
- `Nullable<T>` -> `isNullable`

Prefer early-return guard clauses so the remaining branch becomes the concrete
type.

### 3. Use parser helpers with explicit fallback intent

- If the caller can handle absence, omit the default value.
- If the caller needs a concrete value, pass an explicit fallback.
- Do not pretend a parser can prove a narrower subtype than it actually
  validates at runtime.

### 4. Decide whether globals are really worth it

If you want names like `Optional` or `Nullable` globally available, opt in once
through the dedicated globals entry.

Do not re-create your own package-level global augmentation pattern when the
codebase already standardizes on `@murky-web/typebuddy/globals`.

### 5. Keep tooling opt-in and explicit

If a project wants the typebuddy lint rules, add the typebuddy tooling entry on
purpose. Do not smuggle rule behavior into unrelated base configs.

## Quality Checklist

- absence semantics are encoded intentionally with `Optional`, `Maybe`, or
  `Nullable`
- the guard used matches the wrapper type
- parsers use explicit fallback behavior
- globals are enabled through the dedicated opt-in entry only
- imports stay tree-shake-friendly
- tooling entrypoints are wired intentionally, not implicitly
