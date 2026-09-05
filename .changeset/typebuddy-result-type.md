---
"@murky-web/typebuddy": minor
---

Name the settled result, and stop forcing a result onto code that throws.

`MaybePromise<T>` had a name for `Promise<Success<T> | Failed>` but none for what
it resolves to. Anything holding an already-awaited outcome had to restate the
union or reach for `Awaited<...>` to undo a wrapper that was no longer there —
describing the route taken rather than the thing being held.

```ts
type Result<T> = Success<T> | Failed;
type MaybePromise<T> = Promise<Result<T>>;
```

`AsyncResult<T>` is added as an alias for `MaybePromise<T>`. Elsewhere in the
ecosystem `MaybePromise<T>` almost always means `T | Promise<T>` — a value that
may or may not be a promise — so a reader who knows that convention reads this
one wrong. `MaybePromise` keeps working and is still what `prefer-maybe-promise`
suggests; `AsyncResult` is there for new code.

`prefer-maybe-promise` and `require-try-catch` now leave a function alone when
its body throws. A `throw` is the author saying this failure is not a value to
hand back: a missing manifest for a route being navigated to, an unreachable
branch, a broken invariant. Wrapping those in `err()` turns a bug into a
silently handled outcome, and the caller degrades politely instead of surfacing
that something is wrong. The rules exist to push *recoverable* failures into the
return type, not to abolish throwing.

The exemption is shared between both rules rather than written twice — two rules
disagreeing about what counts as throwing is exactly the drift worth preventing.
A throw inside a nested function belongs to that function and does not count; a
rethrow inside `catch` does.

Measured against the rules' own smoke fixtures: a file with two deliberately
throwing async functions goes from five reports to none, while the existing
violation fixtures are unchanged.
