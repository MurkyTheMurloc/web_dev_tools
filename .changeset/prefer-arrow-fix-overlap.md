---
"@murky-web/oxlint-plugin-solid": patch
---

Fix `prefer-arrow-components` autofix producing overlapping edits when the import and function replacement span different ranges. Import is now embedded directly in the replacement text when needed to avoid multi-range conflicts.
