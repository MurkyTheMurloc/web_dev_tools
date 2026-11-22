const SIMPLELOG_PACKAGE = "@murky-web/simplelog";
const CONSOLE_METHOD_TO_LOGGER_METHOD = {
    debug: "debug",
    error: "error",
    info: "info",
    log: "info",
    trace: "debug",
    warn: "warn"
};
const SIMPLELOG_LOG_METHODS = new Set([
    "debug",
    "error",
    "info",
    "warn",
    "startPerformanceBenchmark",
    "endPerformanceBenchmark",
    "assert"
]);

function isSimplelogSource(source) {
    return (
        typeof source === "string" &&
        (source === SIMPLELOG_PACKAGE ||
            source.startsWith(`${SIMPLELOG_PACKAGE}/`))
    );
}

function isBareSimplelogSource(source) {
    return source === SIMPLELOG_PACKAGE;
}

function isLoggerImportSource(source) {
    return isSimplelogSource(source) && source !== `${SIMPLELOG_PACKAGE}/hono`;
}

function isConsoleObjectExpression(node) {
    if (!node) {
        return false;
    }

    if (node.type === "Identifier" && node.name === "console") {
        return true;
    }

    if (node.type !== "MemberExpression" || node.computed) {
        return false;
    }

    return (
        node.object?.type === "Identifier" &&
        (node.object.name === "globalThis" ||
            node.object.name === "global" ||
            node.object.name === "window") &&
        node.property?.type === "Identifier" &&
        node.property.name === "console"
    );
}

function isLoggerLikeName(name) {
    return typeof name === "string" && /logger/iu.test(name);
}

function isConsoleMethodReference(node) {
    if (!node || node.type !== "MemberExpression" || node.computed) {
        return false;
    }

    return (
        isConsoleObjectExpression(node.object) &&
        node.property?.type === "Identifier" &&
        typeof node.property.name === "string"
    );
}

function isConsoleBindCall(node) {
    if (node?.type !== "CallExpression") {
        return false;
    }

    if (
        node.callee?.type !== "MemberExpression" ||
        node.callee.computed ||
        node.callee.property?.type !== "Identifier" ||
        node.callee.property.name !== "bind"
    ) {
        return false;
    }

    return isConsoleMethodReference(node.callee.object);
}

function collectAssignedNames(node, names = []) {
    if (!node) {
        return names;
    }

    if (node.type === "Identifier") {
        names.push(node.name);
        return names;
    }

    if (node.type === "RestElement") {
        return collectAssignedNames(node.argument, names);
    }

    if (node.type === "AssignmentPattern") {
        return collectAssignedNames(node.left, names);
    }

    if (node.type === "ObjectPattern") {
        for (const property of node.properties ?? []) {
            if (property?.type === "Property") {
                collectAssignedNames(property.value, names);
            }

            if (property?.type === "RestElement") {
                collectAssignedNames(property.argument, names);
            }
        }

        return names;
    }

    if (node.type === "ArrayPattern") {
        for (const element of node.elements ?? []) {
            if (element) {
                collectAssignedNames(element, names);
            }
        }

        return names;
    }

    if (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.property?.type === "Identifier"
    ) {
        names.push(node.property.name);
    }

    return names;
}

function isLoggerLikeTarget(node) {
    return collectAssignedNames(node).some((name) => isLoggerLikeName(name));
}

function isInsideFunctionScope(node) {
    let current = node.parent;

    while (current) {
        if (current.type === "Program") {
            return false;
        }

        if (
            current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression" ||
            current.type === "ArrowFunctionExpression"
        ) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

function getEnclosingFunction(node) {
    let current = node.parent;

    while (current) {
        if (
            current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression" ||
            current.type === "ArrowFunctionExpression"
        ) {
            return current;
        }

        current = current.parent;
    }

    return null;
}

/** The Hono context parameter's name (`c`, `ctx` or `context`), or `null`. */
function getContextParamName(node) {
    for (const param of node?.params ?? []) {
        const name = collectAssignedNames(param).find(
            (candidate) =>
                candidate === "c" ||
                candidate === "ctx" ||
                candidate === "context"
        );
        if (name) {
            return name;
        }
    }

    return null;
}

/** Source text on one line, for quoting code in a message. */
function oneLine(text) {
    return text.replaceAll(/\s+/gu, " ");
}

/**
 * The call with its callee replaced, so a message can hand back the fixed call.
 * Arguments spread over several lines become `(…)`.
 */
function callWithCallee(sourceCode, call, callee) {
    const rest = sourceCode
        .getText(call)
        .slice(call.callee.range[1] - call.range[0]);
    return `${callee}${rest.includes("\n") ? "(…)" : rest}`;
}

/**
 * A logger name to suggest: the file's base name, or its directory's for an
 * `index` file.
 */
function loggerNameHint(context) {
    const parts = (context.filename ?? context.getFilename?.() ?? "").split(
        /[\\/]/u
    );
    const base = (parts.at(-1) ?? "").replace(/\..*$/u, "");
    return (base === "index" ? parts.at(-2) : base) || "app";
}

function isTopLevelNode(node) {
    return node?.parent?.type === "Program";
}

export {
    callWithCallee,
    CONSOLE_METHOD_TO_LOGGER_METHOD,
    getContextParamName,
    loggerNameHint,
    oneLine,
    getEnclosingFunction,
    isBareSimplelogSource,
    isConsoleBindCall,
    isConsoleObjectExpression,
    isConsoleMethodReference,
    isInsideFunctionScope,
    isLoggerImportSource,
    isLoggerLikeTarget,
    isTopLevelNode,
    isSimplelogSource,
    SIMPLELOG_LOG_METHODS,
    SIMPLELOG_PACKAGE
};
