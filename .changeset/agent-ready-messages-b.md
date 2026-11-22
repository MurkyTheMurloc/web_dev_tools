---
"@murky-web/oxlint-plugin-solid": patch
---

The messages of `components-return-once`, `event-handlers`, `imports`,
`jsx-no-duplicate-props`, `jsx-no-script-url`, `jsx-no-undef`,
`no-array-handlers`, `no-innerhtml`, `no-proxy-apis`, `no-react-deps`,
`no-react-specific-props`, `no-server-import-in-client`,
`no-unknown-namespaces`, `prefer-arrow-components`, `prefer-class-object`,
`prefer-for`, `prefer-show`, `self-closing-comp`, `strict-void-return`,
`style-prop` and `validate-jsx-nesting` name the offending code, say what goes
wrong at run time in Solid 2.0, and give a copyable `Fix:` built from the code's
own names, plus a `Do not:` where a tempting non-fix exists. What the rules
report is unchanged.
