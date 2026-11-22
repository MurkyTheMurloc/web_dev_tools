---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": minor
---

New rule `solid/function-size`: eslint's `max-lines-per-function` count (blank
and comment lines don't count, IIFEs count on their own) with a message that
says what to extract and where. Components (a PascalCase function with JSX in a
`.tsx`/`.jsx` file) get `maxComponent`, `createX`/`useX` primitives and other
functions get `max`, each with its own message. Every message allows keeping a
cohesive unit whole with a one-line comment above it and rules out
`// oxlint-disable`.

`oxc-config` warns instead of erroring on size and complexity:
`solid/function-size` at `{ "max": 60, "maxComponent": 80 }` replaces
`eslint/max-lines-per-function` (now off), `eslint/complexity` drops from 30 to
20, and `eslint/max-lines` drops from 1000 to 400 code lines (`skipBlankLines`,
`skipComments`). `**/*.generated.*` files are exempt from all three.
