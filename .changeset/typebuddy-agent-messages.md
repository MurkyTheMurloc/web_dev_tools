---
"@murky-web/typebuddy": patch
---

The oxlint rules' messages quote the code they report (`Promise<string>`,
`return session`, the async function's name) and say what goes wrong at runtime,
then give a copyable `Fix:` built from that code, with the import line from
`@murky-web/typebuddy`. Where there is a tempting non-fix, such as an `as` cast
or returning `ok(...)` from a `catch`, the message says not to. What the rules
report is unchanged.
