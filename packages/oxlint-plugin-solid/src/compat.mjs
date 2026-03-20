import { ASTUtils } from "@typescript-eslint/utils";

export function getSourceCode(context) {
    if (typeof context.getSourceCode === "function") {
        return context.getSourceCode();
    }

    return context.sourceCode;
}

export function getScope(context, node) {
    const sourceCode = getSourceCode(context);

    if (typeof sourceCode.getScope === "function") {
        return sourceCode.getScope(node);
    }

    if (typeof context.getScope === "function") {
        return context.getScope();
    }

    return context.sourceCode.getScope(node);
}

export function findVariable(context, node) {
    return ASTUtils.findVariable(getScope(context, node), node);
}

export function markVariableAsUsed(context, name, node) {
    if (typeof context.markVariableAsUsed === "function") {
        context.markVariableAsUsed(name);
        return;
    }

    const sourceCode = getSourceCode(context);
    if (typeof sourceCode.markVariableAsUsed !== "function") {
        return;
    }

    try {
        sourceCode.markVariableAsUsed(name, node);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("markVariableAsUsed") &&
            error.message.includes("not implemented")
        ) {
            return;
        }

        throw error;
    }
}
