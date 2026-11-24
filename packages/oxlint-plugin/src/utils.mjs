// Generic AST helpers for Oxlint JS plugins, exported as
// `@murky-web/oxlint-plugin/utils` so the specialised plugins
// (oxlint-plugin-solid, oxlint-plugin-typescript) can share them.

const FUNCTIONS = new Set([
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression"
]);

/** `context.sourceCode`, or `context.getSourceCode()` on older hosts. */
export function sourceCodeOf(context) {
    return context.sourceCode ?? context.getSourceCode();
}

/**
 * True when `node` is evaluated while the module loads: outside every function
 * body. Class bodies count, with their computed keys, static fields and static
 * blocks; an instance field initializer runs per `new`, like a function. An
 * IIFE counts as a function (no call analysis).
 */
export function runsAtModuleLoad(node) {
    for (
        let child = node, { parent } = node;
        parent;
        child = parent, { parent } = parent
    ) {
        if (FUNCTIONS.has(parent.type)) {
            return false;
        }
        if (
            (parent.type === "PropertyDefinition" ||
                parent.type === "AccessorProperty") &&
            parent.value === child &&
            !parent.static
        ) {
            return false;
        }
    }
    return true;
}

/** False when a local declaration shadows the global `identifier`. */
export function isGlobalReference(sourceCode, identifier) {
    for (
        let scope = sourceCode.getScope(identifier);
        scope;
        scope = scope.upper
    ) {
        const variable = scope.set.get(identifier.name);
        if (variable) {
            return variable.defs.length === 0;
        }
    }
    return true;
}
