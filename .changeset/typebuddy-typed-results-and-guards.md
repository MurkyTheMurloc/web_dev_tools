---
"@murky-web/typebuddy": minor
---

Add typed error payloads to `Result<T, E>` / `AsyncResult<T, E>` (`err(error)`, `isErr`, `taggedError`, `assertNever`), boundary & combinator helpers (`fromTry`, `fromPromise`, `unwrapOr`, `mapResult`, `mapError`, `allResults`), nominal branding (`Brand<T, Tag>`, `UuidString`, `UlidString`, `NonEmptyString`, `isNonEmptyString`, `createBrandGuard`), lightweight resilience helpers under `@murky-web/typebuddy/async` (`withTimeout`, `withRetry`), switch `prefer-maybe-promise` to suggest `AsyncResult`, teach `require-try-catch` about boundary helpers, and add `typebuddy/no-double-type-assertion` and `typebuddy/no-ignored-result` oxlint rules.
