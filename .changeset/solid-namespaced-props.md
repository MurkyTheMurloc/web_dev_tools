---
"@murky-web/oxlint-plugin-solid": minor
---

`no-unknown-namespaces` has a new option `allowedNamespacedProps`: a list of exact namespaced prop names such as `"client:visible"`. Only these props pass. A typo (`client:visble`) or another prop of the same namespace is still reported, unlike with `allowedNamespaces`, which allows the whole namespace. Setting only one of the two options no longer fails oxlint's option validation.
