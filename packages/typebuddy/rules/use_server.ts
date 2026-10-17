type UseServerNode = {
    type: string;
    parent?: unknown;
    body?: unknown;
};

const USE_SERVER = "use server";

const FUNCTION_TYPES = new Set([
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression",
]);

function isUseServerNode(value: unknown): value is UseServerNode {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        typeof value.type === "string"
    );
}

/**
 * Whether a statement is the `"use server"` directive.
 *
 * Parsers disagree on the shape: ESTree-style ASTs set `directive` on the
 * expression statement, others only give the string literal.
 */
function isUseServerDirective(statement: unknown): boolean {
    if (
        !isUseServerNode(statement) ||
        statement.type !== "ExpressionStatement"
    ) {
        return false;
    }

    if ("directive" in statement && statement.directive === USE_SERVER) {
        return true;
    }

    return (
        "expression" in statement &&
        isUseServerNode(statement.expression) &&
        statement.expression.type === "Literal" &&
        "value" in statement.expression &&
        statement.expression.value === USE_SERVER
    );
}

function startsWithUseServer(statements: unknown): boolean {
    return (
        Array.isArray(statements) &&
        statements.length > 0 &&
        isUseServerDirective(statements[0])
    );
}

function isUseServerFunction(node: UseServerNode): boolean {
    if (!FUNCTION_TYPES.has(node.type) || !isUseServerNode(node.body)) {
        return false;
    }

    return (
        node.body.type === "BlockStatement" && startsWithUseServer(node.body.body)
    );
}

function isInsideUseServerFunction(node: UseServerNode): boolean {
    let current: unknown = node;

    while (isUseServerNode(current)) {
        if (isUseServerFunction(current)) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

/**
 * Exempt server code from a rule.
 *
 * Functions in `"use server"` modules log and throw on failure; the page
 * catches the throw with `<Errored>`. A returned failure would resolve the
 * caller's promise as a success, so the result-returning rules must not touch
 * them. The exemption covers a module whose first statement is the directive
 * and a function whose body starts with it, nested code included.
 *
 * `Program` has to be registered as a visitor next to the guarded ones: it runs
 * first and records whether the whole file is server code.
 */
function createUseServerGuard() {
    let serverModule = false;

    return {
        Program(node: UseServerNode): void {
            serverModule = startsWithUseServer(node.body);
        },
        guard<Node extends UseServerNode>(
            visitor: (node: Node) => void,
        ): (node: Node) => void {
            return (node) => {
                if (serverModule || isInsideUseServerFunction(node)) {
                    return;
                }

                visitor(node);
            };
        },
    };
}

export { createUseServerGuard };
