---
"@murky-web/simplelog": minor
---

Colors only when the output is a terminal. Without an explicit `valueColorMode`, the Node and Bun entries now follow `NO_COLOR`, then `FORCE_COLOR`, then whether stdout is a terminal, so pipes, CI and service logs get plain text instead of raw ANSI codes.

New option `timestampFormat: "iso" | "time"` for the console timestamp. The default is the local time of day (`16:59:23.745`) in a terminal and the full ISO timestamp otherwise; `SIMPLELOG_TIMESTAMP=time|iso` overrides the default. Explicit options always win, and log files always get the ISO timestamp.
