---
"@murky-web/oxc-config": patch
"@murky-web/oxlint-plugin-solid": patch
---

`eslint/require-await` is off in favour of `typescript/require-await`, which
lets an async function that returns a promise do without `await`: in `.ts`,
`createMemo(async () => fetchUser(id()))` now passes both it and
`typescript/promise-function-async`. `.tsx` keeps `promise-function-async` off,
so the docs' `createMemo(() => fetchUser(id()))` stays allowed there.
`reactive-async`'s `return await` fix keeps `async` in `.ts` and drops it in
`.tsx`.
