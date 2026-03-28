---
"@murky-web/simplelog": patch
---

Fix structured logger argument serialization so functions nested inside objects and arrays are preserved as readable labels like `[Function namedHelper]` instead of being dropped by JSON serialization.
