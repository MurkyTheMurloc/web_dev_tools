import { nullableRule } from "./nullable_rule.ts";
import { optionalRule } from "./optional_rule.ts";
import { requireTryCatchAsyncRule } from "./async_rule.ts";
import { errorSafeAsyncRule } from "./maybe_promise_rule.ts";
import { maybeRule } from "./maybe_rule.ts";
export const typebuddy = {
  rules: {
    "prefer-nullable": nullableRule,
    "prefer-optional": optionalRule,
    "require-try-catch": requireTryCatchAsyncRule,
    "prefer-maybe-promise": errorSafeAsyncRule,
    "prefer-maybe": maybeRule,
  },
  configs: {
    recommended: {
      plugins: {
        typebuddy: {
          rules: {
            "prefer-nullable": nullableRule,
            "prefer-optional": optionalRule,
            "prefer-maybe": maybeRule,
            "prefer-maybe-promise": errorSafeAsyncRule,
            "require-try-catch": requireTryCatchAsyncRule,
          },
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
