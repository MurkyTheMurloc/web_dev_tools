---
"@murky-web/oxc-config": patch
---

`import/group-exports` and `import/exports-last` are off: exports stay at the
declaration (`export function a() {}`), the common style, instead of one export
list at the end of the file.
