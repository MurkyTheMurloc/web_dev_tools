const SIMPLELOG_PACKAGE = "@murky-web/simplelog";
const SIMPLELOG_LOG_METHODS = new Set([
    "debug",
    "error",
    "info",
    "warn",
    "startPerformanceBenchmark",
    "endPerformanceBenchmark",
    "assert",
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

function functionHasContextParam(node) {
    if (!node) {
        return false;
    }

    return (node.params ?? []).some((param) => {
        return collectAssignedNames(param).some(
            (name) => name === "c" || name === "ctx" || name === "context",
        );
    });
}

function isTopLevelNode(node) {
    return node?.parent?.type === "Program";
}

export {
    functionHasContextParam,
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
    SIMPLELOG_PACKAGE,
};
