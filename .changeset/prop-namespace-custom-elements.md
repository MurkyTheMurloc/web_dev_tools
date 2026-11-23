---
"@murky-web/oxlint-plugin-solid": patch
---

`no-unknown-namespaces` no longer reports `prop:` on a custom element
(`<my-chart prop:data={points()}>`), where Solid 2.0 uses it to set a property.
It still reports `prop:` on built-in elements.
