---
"@murky-web/oxlint-plugin-solid": minor
---

`reactivity`: report a reactive read after an await, not the `async` keyword.

The rule rejected any async tracked scope, citing the Solid 1.x docs: *"[Solid's]
approach only tracks synchronously. If you have a setTimeout or use an async
function in your Effect the code that executes async after the fact won't be
tracked."*

Solid 2.0 makes async computations a feature — *"Solid computations can return
promises and async iterables"* — and `createMemo(async () => …)` is the shape its
async-reactivity documentation demonstrates. The rule was flagging the official
pattern.

The premise still holds; the conclusion no longer follows. From the 2.0 docs:
*"Dependency tracking is synchronous. An async computation registers reactive
reads made before its first await. Reads made after an await do not create
dependency edges."* So the hazard is not the keyword, it is a read on the far
side of an async gap — it silently registers no dependency, and the computation
cannot re-run when that source changes.

The check now runs where the rule already knows every reactive read in a scope,
and reports the identifier rather than the function, with a message that names
the variable and says what to do. `yield` counts alongside `await`: an async
generator driven by `action` suspends there in the same way. Nested functions are
skipped — their gaps are their own.

Solid's development build raises this at runtime; catching it here also covers
production, where that check is compiled out.

Two new test cases cover a read after `await` and a read after `yield`. A third
asserts that a computation reading its inputs before awaiting produces no
`reactivity` output at all — that fixture was reported by the old rule, so the
test fails against it.
