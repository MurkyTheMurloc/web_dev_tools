---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

A rule for Solid 2.0 refs.

- New rule `solid/init-declarations`: eslint's `init-declarations` ("always"),
  except for a `let` that a `ref` assigns (`let el!: HTMLDivElement;` with
  `ref={el}`, or `el = node` in a ref callback). `oxc-config` turns it on for
  `*.tsx`/`*.jsx` in place of `eslint/init-declarations`, which stays on for
  everything else.
