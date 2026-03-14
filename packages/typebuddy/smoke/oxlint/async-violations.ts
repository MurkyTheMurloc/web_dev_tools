// This file is intentionally wrong.
// The smoke test should report async-specific rules from the typebuddy oxlint plugin.

export async function loadValue(): Promise<string> {
  return "value";
}
