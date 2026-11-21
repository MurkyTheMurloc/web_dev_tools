import { requireTryCatchAsyncRule } from "../rules/async_rule.js";
import { errorSafeAsyncRule } from "../rules/maybe_promise_rule.js";
import { maybeRule } from "../rules/maybe_rule.js";
import { nullableRule } from "../rules/nullable_rule.js";
import { optionalRule } from "../rules/optional_rule.js";
import { withoutTestFiles } from "../rules/test_file.js";

// typebuddy does not apply to test files: every rule is a no-op there.
const rules = {
    "prefer-maybe": withoutTestFiles(maybeRule),
    "prefer-maybe-promise": withoutTestFiles(errorSafeAsyncRule),
    "prefer-nullable": withoutTestFiles(nullableRule),
    "prefer-optional": withoutTestFiles(optionalRule),
    "require-try-catch": withoutTestFiles(requireTryCatchAsyncRule)
} as const satisfies Record<string, unknown>;

type TypebuddyOxlintPlugin = {
    meta: {
        name: string;
    };
    rules: Record<string, unknown>;
};

const plugin: TypebuddyOxlintPlugin = {
    meta: {
        name: "typebuddy"
    },
    rules
};

export default plugin;
export { plugin as typebuddyOxlintPlugin };
