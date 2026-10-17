---
"@murky-web/typebuddy": minor
---

`isSuccess` narrows a `Result<T>` to its `Success<T>` member: after the check,
`result.value` is `T`, not `T | null`. The type parameter is now the whole
result (`isSuccess<Result<T>>(…)` if you spelled it out); inferring it, as
almost every caller does, needs no change.
