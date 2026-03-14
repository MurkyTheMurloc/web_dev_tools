import { nullableRule } from "./nullable_rule.js";
import { optionalRule } from "./optional_rule.js";
import { requireTryCatchAsyncRule } from "./async_rule.js";
import { errorSafeAsyncRule } from "./maybe_promise_rule.js";
import { maybeRule } from "./maybe_rule.js";

const rules = {
  "prefer-nullable": nullableRule,
  "prefer-optional": optionalRule,
  "require-try-catch": requireTryCatchAsyncRule,
  "prefer-maybe-promise": errorSafeAsyncRule,
  "prefer-maybe": maybeRule,
} as const satisfies Record<string, unknown>;

type TypebuddyPlugin = {
  rules: Record<string, unknown>;
  configs: {
    recommended: {
      plugins: {
        typebuddy: {
          rules: Record<string, unknown>;
        },
      },
      rules: Record<string, "error">;
    },
  },
};

export const typebuddy: TypebuddyPlugin = {
  rules,
  configs: {
    recommended: {
      plugins: {
        typebuddy: {
          rules,
        },
      },
      rules: {
        "typebuddy/prefer-nullable": "error",
        "typebuddy/prefer-optional": "error",
        "typebuddy/require-try-catch": "error",
        "typebuddy/prefer-maybe": "error",
        "typebuddy/prefer-maybe-promise": "error",
      },
    },
  },
};
