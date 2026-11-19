---
"@murky-web/typebuddy": minor
---

The oxlint rules (`prefer-maybe`, `prefer-maybe-promise`, `prefer-nullable`, `prefer-optional`, `require-try-catch`) skip test files. Test helpers, fixtures and mocks no longer have to return `MaybePromise` results or use `Maybe`/`Nullable`/`Optional`. A test file is `*.test.*`, `*.spec.*` or `*.bench.*`, anything under a `__tests__/`, `tests/`, `test/` or `__mocks__/` directory, or a `vitest.setup.*`, `vitest-setup.*` or `setupTests.*` file. Names that merely contain `test`, like `latest.ts` or `contest.ts`, are still checked. Directories are matched relative to the directory oxlint runs in, so a project that lives under a folder named `test` is not silenced.
