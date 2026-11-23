# Third-party notices

## eslint-plugin-solid

https://github.com/solidjs-community/eslint-plugin-solid

Most rules of this package are ports of rules from eslint-plugin-solid,
rewritten as plain JavaScript on the Oxlint AST (the original port is the 0.14.5
state, see `meta.version` in `src/index.mjs`; `validate-jsx-nesting` was ported
again from 0.20.0, `reactivity` and `no-unassigned-vars` from 0.20.1).
`upstream/cases.json` holds its test cases at commit d3e946c (0.20.1); the
package does not ship it. The rules, the helpers they share and those test cases
are covered by its licence:

- `components-return-once`, `event-handlers`, `imports`,
  `jsx-no-duplicate-props`, `jsx-no-script-url`, `jsx-no-undef`,
  `jsx-uses-vars`, `no-array-handlers`, `no-destructure`, `no-innerhtml`,
  `no-proxy-apis`, `no-react-deps`, `no-react-specific-props`,
  `no-unassigned-vars`, `no-unknown-namespaces`, `prefer-for`, `prefer-show`,
  `reactivity`, `self-closing-comp`, `style-prop`, `validate-jsx-nesting`
  (`src/rules/`)
- `prefer-class-object`, derived from the upstream rule `prefer-classlist`
- the helpers in `src/utils.mjs` and `src/compat.mjs`

The rules `no-owned-primitives-in-ref`, `no-server-import-in-client`,
`no-setter-in-effect`, `no-untracked-effect-read`, `prefer-arrow-components`,
`reactive-async` and `strict-void-return` are not from eslint-plugin-solid.

```
MIT License

Copyright (c) 2021 Josh Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ESLint

https://github.com/eslint/eslint

`no-magic-numbers` (`src/rules/no_magic_numbers.mjs`) is a fork of ESLint's
`no-magic-numbers` rule (`lib/rules/no-magic-numbers.js`) and is covered by its
licence:

```
Copyright OpenJS Foundation and other contributors, <www.openjsf.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## typescript-eslint

https://github.com/typescript-eslint/typescript-eslint

The TypeScript options of `no-magic-numbers` (`ignoreEnums`,
`ignoreNumericLiteralTypes`, `ignoreReadonlyClassProperties`,
`ignoreTypeIndexes`) follow typescript-eslint's extension of the rule
(`packages/eslint-plugin/src/rules/no-magic-numbers.ts`), covered by its
licence:

```
MIT License

Copyright (c) 2019 typescript-eslint and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## validate-html-nesting

`validate-html-nesting` (ISC, Copyright (c) Manan Tank) is a dependency of this
package and no code of it is copied into the repository, so its own licence file
travels with the installed package.
