import globalMiddlewarePlacementRule from "./rules/global_middleware_placement.mjs";
import noCommentedOutRouteRule from "./rules/no_commented_out_route.mjs";
import noDuplicatePathParamsRule from "./rules/no_duplicate_path_params.mjs";
import noDuplicateRoutesRule from "./rules/no_duplicate_routes.mjs";
import noMultipleNextRule from "./rules/no_multiple_next.mjs";
import noProcessEnvRule from "./rules/no_process_env.mjs";
import noUnusedContextResponseRule from "./rules/no_unused_context_response.mjs";
import paramNameMismatchRule from "./rules/param_name_mismatch.mjs";
import preferHttpExceptionRule from "./rules/prefer_http_exception.mjs";

const plugin = {
    meta: {
        name: "hono"
    },
    rules: {
        "global-middleware-placement": globalMiddlewarePlacementRule,
        "no-commented-out-route": noCommentedOutRouteRule,
        "no-duplicate-path-params": noDuplicatePathParamsRule,
        "no-duplicate-routes": noDuplicateRoutesRule,
        "no-multiple-next": noMultipleNextRule,
        "no-process-env": noProcessEnvRule,
        "no-unused-context-response": noUnusedContextResponseRule,
        "param-name-mismatch": paramNameMismatchRule,
        "prefer-http-exception": preferHttpExceptionRule
    }
};

// oxlint-disable-next-line import/no-default-export -- Oxlint JS plugins require a default export surface.
export default plugin;
