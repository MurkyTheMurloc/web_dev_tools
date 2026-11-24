---
"@murky-web/oxlint-plugin": minor
---

New package `@murky-web/oxlint-plugin`, the base of the oxlint plugin family
(prefix `murky`): generic JavaScript rules, with Solid rules in
`oxlint-plugin-solid` and TypeScript rules in a later `oxlint-plugin-typescript`.
`@murky-web/oxlint-plugin/utils` exports the shared helpers `sourceCodeOf`,
`runsAtModuleLoad` and `isGlobalReference`.

First rule `murky/prefer-string-raw`, a fork of unicorn's `prefer-string-raw`
that looks at when the code runs. Inside a function it reports `"a\\b"` like
unicorn and fixes it to `` String.raw`a\b` ``. At module load it is the other
way round: `String.raw` is a function call a bundler cannot prove pure, so it
stays in every client chunk that imports the module, even when the value is
unused. There a plain literal is allowed and `` String.raw`<` `` is
reported and fixed to `"\\u003c"`.
