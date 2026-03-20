import componentsReturnOnceRule from "./rules/components_return_once.mjs";
import eventHandlersRule from "./rules/event_handlers.mjs";
import importsRule from "./rules/imports.mjs";
import jsxNoDuplicatePropsRule from "./rules/jsx_no_duplicate_props.mjs";
import { jsxNoScriptUrlRule } from "./rules/jsx_no_script_url.mjs";
import jsxNoUndefRule from "./rules/jsx_no_undef.mjs";
import { jsxUsesVarsRule } from "./rules/jsx_uses_vars.mjs";
import { noArrayHandlersRule } from "./rules/no_array_handlers.mjs";
import noDestructureRule from "./rules/no_destructure.mjs";
import noInnerhtmlRule from "./rules/no_innerhtml.mjs";
import noProxyApisRule from "./rules/no_proxy_apis.mjs";
import noReactDepsRule from "./rules/no_react_deps.mjs";
import { noReactSpecificPropsRule } from "./rules/no_react_specific_props.mjs";
import noUnknownNamespacesRule from "./rules/no_unknown_namespaces.mjs";
import { preferArrowComponentsRule } from "./rules/prefer_arrow_components.mjs";
import preferClasslistRule from "./rules/prefer_classlist.mjs";
import preferForRule from "./rules/prefer_for.mjs";
import preferShowRule from "./rules/prefer_show.mjs";
import reactivityRule from "./rules/reactivity.mjs";
import selfClosingCompRule from "./rules/self_closing_comp.mjs";
import stylePropRule from "./rules/style_prop.mjs";
import validateJsxNestingRule from "./rules/validate_jsx_nesting.mjs";

const extendedPlugin = {
    meta: {
        name: "solid",
        version: "0.14.5",
    },
    rules: {
        "components-return-once": componentsReturnOnceRule,
        "event-handlers": eventHandlersRule,
        imports: importsRule,
        "jsx-no-duplicate-props": jsxNoDuplicatePropsRule,
        "jsx-no-script-url": jsxNoScriptUrlRule,
        "jsx-no-undef": jsxNoUndefRule,
        "jsx-uses-vars": jsxUsesVarsRule,
        "no-array-handlers": noArrayHandlersRule,
        "no-destructure": noDestructureRule,
        "no-innerhtml": noInnerhtmlRule,
        "no-proxy-apis": noProxyApisRule,
        "no-react-deps": noReactDepsRule,
        "no-react-specific-props": noReactSpecificPropsRule,
        "no-unknown-namespaces": noUnknownNamespacesRule,
        "prefer-arrow-components": preferArrowComponentsRule,
        "prefer-classlist": preferClasslistRule,
        "prefer-for": preferForRule,
        "prefer-show": preferShowRule,
        reactivity: reactivityRule,
        "self-closing-comp": selfClosingCompRule,
        "style-prop": stylePropRule,
        "validate-jsx-nesting": validateJsxNestingRule,
    },
};

// oxlint-disable-next-line import/no-default-export -- Oxlint JS plugins require a default export surface.
export default extendedPlugin;
