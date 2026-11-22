---
"@murky-web/oxlint-plugin-solid": patch
---

`reactivity` names the fix when a reactive value is read where a handler on a
native element is bound (`onClick={editing() ? save : cancel}`): the message
quotes the expression and gives a copyable replacement with the code's own
names, and says not to use `untrack()` or disable the rule.
