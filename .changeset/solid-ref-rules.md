---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

Two rules for Solid 2.0 refs.

- New rule `solid/init-declarations`: eslint's `init-declarations` ("always"),
  except for a `let` that a `ref` assigns (`let el!: HTMLDivElement;` with
  `ref={el}`, or `el = node` in a ref callback). `oxc-config` turns it on for
  `*.tsx`/`*.jsx` in place of `eslint/init-declarations`, which stays on for
  everything else.
- New rule `solid/prefer-ref-shorthand`: autofixes a ref callback that only
  stores the element, `ref={(node) => { el = node; }}`, to `ref={el}`, and
  reports a bare variable in a `ref={[…]}` array, which Solid never assigns,
  with the suggestion `(node) => { el = node; }`. On in `oxc-config`.
