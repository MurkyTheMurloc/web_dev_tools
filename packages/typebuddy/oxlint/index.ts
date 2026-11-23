import { requireTryCatchAsyncRule } from "../rules/async_rule.js";
import { errorSafeAsyncRule } from "../rules/maybe_promise_rule.js";
import { maybeRule } from "../rules/maybe_rule.js";
import { nullableRule } from "../rules/nullable_rule.js";
import { optionalRule } from "../rules/optional_rule.js";
import { withoutTestFiles } from "../rules/test_file.js";
import { uselessUndefinedRule } from "../rules/useless_undefined_rule.js";

// The typebuddy conventions do not apply to test files: those rules are a no-op
// there. `no-useless-undefined` is a fork of unicorn's rule and lints test files
// as the unicorn rule it replaces did.
const rules = {
    "no-useless-undefined": uselessUndefinedRule,
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
