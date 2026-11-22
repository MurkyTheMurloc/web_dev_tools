---
"@murky-web/typebuddy": minor
---

New oxlint rule `typebuddy/no-useless-undefined`: unicorn's
`no-useless-undefined` as oxlint ships it, with its options and autofixes,
except that `let x: Optional<T> = undefined` (or `T | undefined`) is allowed,
because `undefined` is the start value of an `Optional<T>` as `null` is of a
`Maybe<T>`. An un-annotated `let x = undefined` is reported without an autofix
and its message says to annotate it or give a real default, not to drop the
initializer that `eslint/init-declarations` asks for. Trailing `undefined`
arguments are reported without an autofix.
