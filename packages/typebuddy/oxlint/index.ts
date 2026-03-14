import { requireTryCatchAsyncRule } from "../eslint/async_rule.js";
import { errorSafeAsyncRule } from "../eslint/maybe_promise_rule.js";
import { maybeRule } from "../eslint/maybe_rule.js";
import { nullableRule } from "../eslint/nullable_rule.js";
import { optionalRule } from "../eslint/optional_rule.js";

const rules = {
  "prefer-maybe-promise": errorSafeAsyncRule,
  "prefer-maybe": maybeRule,
  "prefer-nullable": nullableRule,
  "prefer-optional": optionalRule,
  "require-try-catch": requireTryCatchAsyncRule,
} as const satisfies Record<string, unknown>;

type TypebuddyOxlintPlugin = {
  meta: {
    name: string;
  };
  rules: Record<string, unknown>;
};

const plugin: TypebuddyOxlintPlugin = {
  meta: {
    name: "typebuddy",
  },
  rules,
};

export default plugin;
export { plugin as typebuddyOxlintPlugin };
