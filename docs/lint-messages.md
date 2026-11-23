# Lint messages

Our lint rules are read by people and, more and more, by coding agents that
apply a message as written. A message is good when an agent that sees only the
message and the reported line can fix the code correctly on the first try,
without guessing and without silencing the rule.

## Shape

Every message has up to four parts, in this order:

1. **What.** The offending name or expression from the code, in backticks,
   filled in through `data` (`'{{name}}'`, `` `{{expression}}` ``). Never a
   generic "this variable".
2. **Why.** One sentence on the runtime consequence: what goes wrong, when. "is
   evaluated once and later changes are ignored", "Solid throws
   MISSING_EFFECT_FN in dev", "the type widens to `string`". No style talk when
   there is a real consequence.
3. **`Fix:`** A copyable replacement, built from the code's own names via `data`
   wherever the rule has them
   (`onClick={(event) => (editing() ? save : cancel)?.(event)}`), otherwise a
   minimal concrete pattern. If there are two valid fixes, name both and when to
   pick which. If the rule has an autofix or suggestion, the message still
   states the fix.
4. **`Do not:`** The tempting non-fixes that hide the problem, when they exist:
   `untrack()`, `// oxlint-disable`, `as any`, copying into a local, adding
   `async`. Leave this out when there is no tempting wrong fix.

## Rules of thumb

- One message per problem. Two rules never report the same thing.
- Literal identifiers and code over prose. Backticks around code.
- No "consider", "might", "you may want to". Say what to do.
- English, present tense, at most about four sentences.
- A message without a meaningful fix (e.g. an undefined JSX name) still says
  what to check: "Import `Foo` or fix its spelling."
- When a message names a Solid or runtime diagnostic code
  (`UNTRACKED_READ_AFTER_AWAIT`, `MISSING_EFFECT_FN`), keep it: agents search
  for it.
- Tests assert on the `Fix:` text, so a message change shows up in review.
