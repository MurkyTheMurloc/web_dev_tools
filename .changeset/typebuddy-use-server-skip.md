---
"@murky-web/typebuddy": minor
---

`require-try-catch` and `prefer-maybe-promise` skip `"use server"` code: files whose first statement is the directive, and functions whose body starts with it. Server functions log and throw on failure and the page catches the throw with `<Errored>`; a returned failure would resolve the caller's promise as success.
