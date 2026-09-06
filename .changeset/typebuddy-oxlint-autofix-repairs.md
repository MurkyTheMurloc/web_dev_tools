---
"@murky-web/typebuddy": minor
---

Repair the oxlint autofixes and close the rules' blind spots.

Two fixes were producing broken code. `prefer-maybe-promise` inserted
`return err()` directly before a catch block's closing brace, so
`catch { log("boom") }` became `catch { log("boom") return err(); }`, which does
not parse. `require-try-catch` rebuilt the function body line by line and
stripped leading whitespace from every line — including lines inside template
literals, silently changing string values. It now wraps the body with two
zero-width insertions and leaves it byte for byte intact.

Six blind spots closed:

- The catch branch settles on `err()`. It was fed to the same code path as the
  try block, so a catch return got two reports with opposite fixes (`ok(value)`
  and `err()`), and `--fix` appended an unreachable `return err()` after an
  existing return. Returns that hand back a value are now reported without a
  fix — rewriting them to `err()` would drop the author's fallback, and where
  the default belongs is the author's decision.
- Returns nested inside an `if`, loop or `switch` in a try block are wrapped.
  Only the try block's direct children were, so `try { if (flag) return "early";
  return "late"; }` wrapped just `"late"`.
- `Promise<T>` in a type-level signature is reported. `TSDeclareFunction`,
  `TSFunctionType` and `TSMethodSignature` were routed through a check for
  `async`, which a type signature can never carry, so all three visitors were
  unreachable. Ambient `declare` context stays exempt: rewriting a third-party
  callback shape would misdescribe that API.
- `MaybePromise` and `AsyncResult` count as awaited return types. Matching only
  `Promise` meant a bare `return;` in a `MaybePromise<void>` function was left
  alone while its `Promise<void>` twin was fixed — the rule went blind on
  already-migrated code, and on the spelling the package recommends.
- Expression-bodied async arrows are reported and fixed. `async () => fetch(url)`
  has no block for the try/catch to live in and escaped entirely.
- `null | undefined` is left alone instead of being rewritten to the
  equivalent-but-longer `Optional<null>`.

Also fixed: an inserted helper import landed glued to the following statement in
any file that starts with a comment. Whether to append after an existing import
was inferred from the anchor's byte offset, which only answers that question in
a file whose first statement begins at byte zero.
