---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

New rule `solid/no-unassigned-vars`, ported from eslint-plugin-solid 0.20.1:
eslint's `no-unassigned-vars`, except that `ref={el}` and `ref={el!}` count as
an assignment. A bare `el` in a `ref={[…]}` array is left to
`solid/prefer-ref-shorthand`. `oxc-config` turns it on for `*.tsx`/`*.jsx` in
place of `eslint/no-unassigned-vars`, which stays on for everything else.
