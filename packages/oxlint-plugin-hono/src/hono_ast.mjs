// Shared AST and path helpers for @murky-web/oxlint-plugin-hono.

export const ROUTE_METHODS = new Set([
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "all"
]);

export const CHAIN_METHODS = new Set([
    ...ROUTE_METHODS,
    "on",
    "use",
    "route",
    "onError",
    "notFound"
]);

export const RESPONSE_METHODS = new Set([
    "json",
    "text",
    "html",
    "body",
    "redirect",
    "notFound",
    "newResponse",
    "render"
]);

const FUNCTION_TYPES = new Set([
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression"
]);

const HONO_HANDLER_TYPE_NAMES = new Set([
    "ErrorHandler",
    "Handler",
    "MiddlewareHandler",
    "NotFoundHandler"
]);

export function isFunctionNode(node) {
    return node !== null && node !== undefined && FUNCTION_TYPES.has(node.type);
}

/**
 * Unwraps TS expression wrappers (`as`, `satisfies`, `!`, type assertion) so
 * rules see the underlying expression node.
 */
export function unwrapExpression(node) {
    let current = node;
    while (
        current &&
        (current.type === "TSAsExpression" ||
            current.type === "TSSatisfiesExpression" ||
            current.type === "TSNonNullExpression" ||
            current.type === "TSTypeAssertion" ||
            current.type === "ChainExpression")
    ) {
        current = current.expression;
    }
    return current ?? null;
}

/** Static string value of a string literal or no-interpolation template literal. */
export function getStaticString(node) {
    const target = unwrapExpression(node);
    if (!target) {
        return null;
    }
    if (target.type === "Literal" && typeof target.value === "string") {
        return target.value;
    }
    if (
        target.type === "TemplateLiteral" &&
        target.expressions.length === 0 &&
        target.quasis.length === 1
    ) {
        return target.quasis[0].value.cooked ?? null;
    }
    return null;
}

/**
 * Extracts static string(s) from either a single string node or an
 * ArrayExpression of strings.
 */
export function getStaticStringList(node) {
    const target = unwrapExpression(node);
    if (!target) {
        return null;
    }
    const single = getStaticString(target);
    if (single !== null) {
        return [single];
    }
    if (target.type === "ArrayExpression") {
        const items = [];
        for (const element of target.elements) {
            if (!element || element.type === "SpreadElement") {
                return null;
            }
            const value = getStaticString(element);
            if (value === null) {
                return null;
            }
            items.push(value);
        }
        return items;
    }
    return null;
}

/** Joins a base path and sub-path into a clean route path. */
export function joinPaths(basePath, routePath) {
    if (!basePath || basePath === "/") {
        return routePath || "/";
    }
    if (!routePath || routePath === "/") {
        return basePath;
    }
    const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    const cleanRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
    return `${cleanBase}${cleanRoute}`;
}

/** Normalizes slashes and removes trailing slash (except for root "/"). */
export function normalizePath(path) {
    const collapsed = path.replace(/\/{2,}/gu, "/");
    if (collapsed.length > 1 && collapsed.endsWith("/")) {
        return collapsed.slice(0, -1);
    }
    return collapsed || "/";
}

/**
 * Extracts Hono `:param` definitions from a route path while ignoring colons
 * inside `{...}` regex constraints (such as `/:id{(?:a|b)}` or
 * `/:id{[0-9]{1,3}}`).
 */
export function extractPathParams(path) {
    const params = [];
    let index = 0;

    while (index < path.length) {
        const ch = path[index];

        // Skip balanced `{...}` regex blocks anywhere in the path.
        if (ch === "{") {
            let depth = 1;
            index += 1;
            while (index < path.length && depth > 0) {
                if (path[index] === "\\") {
                    index += 2;
                    continue;
                }
                if (path[index] === "{") {
                    depth += 1;
                } else if (path[index] === "}") {
                    depth -= 1;
                }
                index += 1;
            }
            continue;
        }

        // A Hono parameter starts with `:` at the start of a path or right after `/`.
        if (ch === ":" && (index === 0 || path[index - 1] === "/")) {
            const start = index;
            index += 1;
            let nameEnd = index;
            while (
                nameEnd < path.length &&
                /[A-Za-z0-9_-]/u.test(path[nameEnd])
            ) {
                nameEnd += 1;
            }
            const name = path.slice(index, nameEnd);
            index = nameEnd;

            // Skip optional `{regex}` immediately following `:name`.
            if (index < path.length && path[index] === "{") {
                let depth = 1;
                index += 1;
                while (index < path.length && depth > 0) {
                    if (path[index] === "\\") {
                        index += 2;
                        continue;
                    }
                    if (path[index] === "{") {
                        depth += 1;
                    } else if (path[index] === "}") {
                        depth -= 1;
                    }
                    index += 1;
                }
            }

            let optional = false;
            if (index < path.length && path[index] === "?") {
                optional = true;
                index += 1;
            }

            if (name.length > 0) {
                params.push({ index: start, name, optional });
            }
            continue;
        }

        index += 1;
    }

    return params;
}

/** Resolves an Identifier to its ESLint/Oxlint Scope Variable, or null. */
export function resolveVariable(sourceCode, identifier) {
    if (!identifier || identifier.type !== "Identifier") {
        return null;
    }
    try {
        for (
            let scope = sourceCode.getScope(identifier);
            scope;
            scope = scope.upper
        ) {
            const variable = scope.set.get(identifier.name);
            if (variable) {
                return variable;
            }
        }
    } catch {
        return null;
    }
    return null;
}

/** Extracts the referenced type identifier name from a TS type annotation. */
function getTypeReferenceName(typeAnnotation) {
    const typeNode =
        typeAnnotation?.type === "TSTypeAnnotation"
            ? typeAnnotation.typeAnnotation
            : typeAnnotation;
    if (!typeNode) {
        return null;
    }
    if (typeNode.type === "TSTypeReference") {
        if (typeNode.typeName.type === "Identifier") {
            return typeNode.typeName.name;
        }
        if (
            typeNode.typeName.type === "TSQualifiedName" &&
            typeNode.typeName.right.type === "Identifier"
        ) {
            return typeNode.typeName.right.name;
        }
    }
    return null;
}

/**
 * Checks whether a node's identifier is shadowed by an inner binding relative
 * to `targetVariable` (when `targetVariable` is known).
 */
export function refersToVariable(
    sourceCode,
    identifier,
    targetVariable,
    fallbackName
) {
    if (!identifier || identifier.type !== "Identifier") {
        return false;
    }
    if (identifier.name !== fallbackName) {
        return false;
    }
    if (!targetVariable) {
        return true;
    }
    const resolved = resolveVariable(sourceCode, identifier);
    return resolved === null || resolved === targetVariable;
}

/**
 * Returns the branch-path signature of `node` as an array of `{ branchNode,
 * side }` entries so rules can tell whether two statements live in mutually
 * exclusive `if`/`else` or `switch` branches.
 */
export function getBranchPath(node) {
    const path = [];
    for (
        let child = node, { parent } = node;
        parent;
        child = parent, { parent } = parent
    ) {
        if (parent.type === "IfStatement") {
            if (parent.consequent === child) {
                path.push({ branchNode: parent, side: "consequent" });
            } else if (parent.alternate === child) {
                path.push({ branchNode: parent, side: "alternate" });
            }
        } else if (
            parent.type === "SwitchCase" &&
            parent.parent?.type === "SwitchStatement"
        ) {
            path.push({ branchNode: parent.parent, side: parent });
        } else if (parent.type === "ConditionalExpression") {
            if (parent.consequent === child) {
                path.push({ branchNode: parent, side: "consequent" });
            } else if (parent.alternate === child) {
                path.push({ branchNode: parent, side: "alternate" });
            }
        } else if (isFunctionNode(parent)) {
            break;
        }
    }
    return path;
}

/**
 * True when two nodes sit in mutually exclusive branches of the same
 * `if`/`switch`/ternary.
 */
export function areMutuallyExclusive(nodeA, nodeB) {
    const pathA = getBranchPath(nodeA);
    const pathB = getBranchPath(nodeB);
    for (const a of pathA) {
        for (const b of pathB) {
            if (a.branchNode === b.branchNode && a.side !== b.side) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Tracks Hono imports, app instances (`new Hono()`, `.basePath(...)`,
 * `createFactory().createApp()`, typed `app: Hono` params), and factory helpers
 * across a single file.
 */
export function createHonoTracker(sourceCode) {
    const honoConstructors = new Set();
    const factoryCreators = new Set();
    const middlewareCreators = new Set();
    const contextTypes = new Set();
    const nextTypes = new Set();
    const handlerTypes = new Set();

    // Keyed by Scope Variable (when resolvable) or fallback string name.
    const appBindings = new Map();
    const factoryBindings = new Set();
    // Tracks anonymous inline `new Hono()` / `createApp()` roots by AST node.
    const anonymousAppInfos = new WeakMap();
    // Sub-app key -> Set of mounted parent paths (for `app.route("/orgs/:orgId", subApp)`).
    const mountedPrefixes = new Map();

    let hasHonoImport = false;
    let nextAppId = 1;

    function keyForIdentifier(identifier) {
        return resolveVariable(sourceCode, identifier) ?? identifier.name;
    }

    function registerAppKey(key, name, basePath, rootId) {
        const info = {
            basePath,
            id: rootId ?? nextAppId++,
            key,
            name
        };
        appBindings.set(key, info);
        return info;
    }

    function isHonoConstructorExpr(expr) {
        const node = unwrapExpression(expr);
        if (!node) {
            return false;
        }
        if (
            node.type === "NewExpression" &&
            node.callee.type === "Identifier" &&
            honoConstructors.has(node.callee.name)
        ) {
            return true;
        }
        return false;
    }

    function isFactoryCreateAppCall(expr) {
        const node = unwrapExpression(expr);
        if (
            node?.type !== "CallExpression" ||
            node.callee.type !== "MemberExpression" ||
            node.callee.computed ||
            node.callee.property.type !== "Identifier" ||
            node.callee.property.name !== "createApp"
        ) {
            return false;
        }
        const object = unwrapExpression(node.callee.object);
        if (object?.type === "Identifier") {
            return factoryBindings.has(keyForIdentifier(object));
        }
        return isCreateFactoryCall(object);
    }

    function isCreateFactoryCall(expr) {
        const node = unwrapExpression(expr);
        return (
            node?.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            factoryCreators.has(node.callee.name)
        );
    }

    function isCreateMiddlewareCall(callNode) {
        const node = unwrapExpression(callNode);
        if (node?.type !== "CallExpression") {
            return false;
        }
        if (
            node.callee.type === "Identifier" &&
            middlewareCreators.has(node.callee.name)
        ) {
            return true;
        }
        if (
            node.callee.type === "MemberExpression" &&
            !node.callee.computed &&
            node.callee.property.type === "Identifier" &&
            node.callee.property.name === "createMiddleware"
        ) {
            const object = unwrapExpression(node.callee.object);
            if (object?.type === "Identifier") {
                return factoryBindings.has(keyForIdentifier(object));
            }
            return isCreateFactoryCall(object);
        }
        return false;
    }

    function isCreateHandlersCall(callNode) {
        const node = unwrapExpression(callNode);
        if (
            node?.type !== "CallExpression" ||
            node.callee.type !== "MemberExpression" ||
            node.callee.computed ||
            node.callee.property.type !== "Identifier" ||
            node.callee.property.name !== "createHandlers"
        ) {
            return false;
        }
        const object = unwrapExpression(node.callee.object);
        if (object?.type === "Identifier") {
            return factoryBindings.has(keyForIdentifier(object));
        }
        return isCreateFactoryCall(object);
    }

    /**
     * Resolves an expression to its Hono app info `{ id, name, basePath, key
     * }`, walking chains such as `app.basePath("/v1").get("/a",
     * ...).post(...)`.
     */
    function getAppInfo(expr) {
        const node = unwrapExpression(expr);
        if (!node) {
            return null;
        }

        if (node.type === "Identifier") {
            const key = keyForIdentifier(node);
            return appBindings.get(key) ?? null;
        }

        if (isHonoConstructorExpr(node) || isFactoryCreateAppCall(node)) {
            let info = anonymousAppInfos.get(node);
            if (!info) {
                info = {
                    basePath: "",
                    id: nextAppId++,
                    key: node,
                    name: "new Hono()"
                };
                anonymousAppInfos.set(node, info);
            }
            return info;
        }

        if (
            node.type === "CallExpression" &&
            node.callee.type === "MemberExpression" &&
            !node.callee.computed &&
            node.callee.property.type === "Identifier"
        ) {
            const method = node.callee.property.name;
            const receiver = getAppInfo(node.callee.object);
            if (!receiver) {
                return null;
            }
            if (method === "basePath") {
                const segment = getStaticString(node.arguments[0]);
                const nextBase =
                    receiver.basePath !== null && segment !== null
                        ? joinPaths(receiver.basePath, segment)
                        : null;
                return {
                    ...receiver,
                    basePath: nextBase
                };
            }
            if (CHAIN_METHODS.has(method)) {
                return receiver;
            }
        }

        return null;
    }

    function handleImportDeclaration(node) {
        const source = node.source?.value;
        if (typeof source !== "string") {
            return;
        }
        if (source !== "hono" && !source.startsWith("hono/")) {
            return;
        }
        hasHonoImport = true;

        for (const specifier of node.specifiers) {
            if (specifier.type !== "ImportSpecifier") {
                continue;
            }
            const imported =
                specifier.imported.type === "Identifier"
                    ? specifier.imported.name
                    : specifier.imported.value;
            const local = specifier.local.name;

            if (imported === "Hono") {
                honoConstructors.add(local);
            } else if (imported === "createFactory") {
                factoryCreators.add(local);
            } else if (imported === "createMiddleware") {
                middlewareCreators.add(local);
            } else if (imported === "Context") {
                contextTypes.add(local);
            } else if (imported === "Next") {
                nextTypes.add(local);
            } else if (HONO_HANDLER_TYPE_NAMES.has(imported)) {
                handlerTypes.add(local);
            }
        }
    }

    function handleVariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !node.init) {
            return;
        }

        const key = keyForIdentifier(node.id);
        if (isCreateFactoryCall(node.init)) {
            factoryBindings.add(key);
            return;
        }

        const appInfo = getAppInfo(node.init);
        if (appInfo) {
            // `const api = app.basePath("/api")` shares the underlying app `id`
            // so duplicate routes & middleware ordering are checked across the
            // same app instance, while carrying its own `basePath`.
            registerAppKey(key, node.id.name, appInfo.basePath, appInfo.id);
        }
    }

    function handleFunction(node) {
        for (const param of node.params) {
            const target =
                param.type === "AssignmentPattern" ? param.left : param;
            if (target.type !== "Identifier" || !target.typeAnnotation) {
                continue;
            }
            const typeName = getTypeReferenceName(target.typeAnnotation);
            if (typeName && honoConstructors.has(typeName)) {
                registerAppKey(
                    keyForIdentifier(target),
                    target.name,
                    "",
                    undefined
                );
            }
        }
    }

    function isGlobalUseCall(callNode) {
        const args = callNode.arguments;
        if (args.length === 0) {
            return false;
        }
        if (args.length === 1) {
            return true;
        }
        const firstArg = unwrapExpression(args[0]);
        const staticFirst = getStaticString(firstArg);
        if (staticFirst !== null) {
            return staticFirst === "*" || staticFirst === "/*";
        }
        // `app.use(mw1, mw2)` without a path argument: first arg is clearly a
        // middleware function or middleware factory call (e.g. `cors()`).
        if (isFunctionNode(firstArg) || firstArg?.type === "CallExpression") {
            return true;
        }
        return false;
    }

    /**
     * Classifies a CallExpression on a tracked Hono app instance. Returns null
     * when the call is not a Hono app registration call.
     */
    function inspectAppCall(callNode) {
        if (
            callNode.callee.type !== "MemberExpression" ||
            callNode.callee.computed ||
            callNode.callee.property.type !== "Identifier"
        ) {
            return null;
        }

        const method = callNode.callee.property.name;
        if (method !== "basePath" && !CHAIN_METHODS.has(method)) {
            return null;
        }

        const app = getAppInfo(callNode.callee.object);
        if (!app) {
            return null;
        }

        const args = callNode.arguments;

        if (method === "basePath") {
            const path = getStaticString(args[0]);
            return {
                app,
                handlers: [],
                isGlobalMiddleware: false,
                kind: "basePath",
                method,
                methods: [],
                pathNodes: [args[0] ?? null],
                paths: [path]
            };
        }

        if (ROUTE_METHODS.has(method)) {
            const firstPath = getStaticString(args[0]);
            // `app.get(handler)` without path is valid in Hono (shorthand on chained path).
            const hasExplicitPath =
                args.length >= 2 ||
                firstPath !== null ||
                (args[0] && !isFunctionNode(unwrapExpression(args[0])));
            const handlerArgs = hasExplicitPath ? args.slice(1) : args;
            return {
                app,
                handlers: handlerArgs
                    .map(unwrapExpression)
                    .filter(isFunctionNode),
                isGlobalMiddleware: false,
                kind: "route",
                method,
                methods: [method.toUpperCase()],
                pathNodes: [hasExplicitPath ? (args[0] ?? null) : null],
                paths: [hasExplicitPath ? firstPath : null]
            };
        }

        if (method === "on") {
            const methods = getStaticStringList(args[0])?.map((item) =>
                item.toUpperCase()
            );
            const paths = getStaticStringList(args[1]);
            const pathNodes =
                unwrapExpression(args[1])?.type === "ArrayExpression"
                    ? unwrapExpression(args[1]).elements
                    : [args[1] ?? null];
            return {
                app,
                handlers: args
                    .slice(2)
                    .map(unwrapExpression)
                    .filter(isFunctionNode),
                isGlobalMiddleware: false,
                kind: "route",
                method,
                methods: methods ?? [],
                pathNodes,
                paths: paths ?? [null]
            };
        }

        if (method === "use") {
            const firstPath =
                args.length >= 2 ? getStaticString(args[0]) : null;
            const handlerStart = firstPath !== null ? 1 : 0;
            return {
                app,
                handlers: args
                    .slice(handlerStart)
                    .map(unwrapExpression)
                    .filter(isFunctionNode),
                isGlobalMiddleware: isGlobalUseCall(callNode),
                kind: "use",
                method,
                methods: [],
                pathNodes: [firstPath !== null ? args[0] : null],
                paths: [firstPath]
            };
        }

        if (method === "route") {
            const prefix = getStaticString(args[0]);
            const subApp = args[1] ? getAppInfo(args[1]) : null;
            if (prefix !== null && subApp) {
                const fullPrefix =
                    app.basePath !== null
                        ? joinPaths(app.basePath, prefix)
                        : prefix;
                let prefixes = mountedPrefixes.get(subApp.id);
                if (!prefixes) {
                    prefixes = new Set();
                    mountedPrefixes.set(subApp.id, prefixes);
                }
                prefixes.add(fullPrefix);
            }
            return {
                app,
                handlers: [],
                isGlobalMiddleware: false,
                kind: "subapp",
                method,
                methods: [],
                pathNodes: [args[0] ?? null],
                paths: [prefix],
                subApp
            };
        }

        if (method === "onError" || method === "notFound") {
            return {
                app,
                handlers: args.map(unwrapExpression).filter(isFunctionNode),
                isGlobalMiddleware: false,
                kind: method,
                method,
                methods: [],
                pathNodes: [],
                paths: []
            };
        }

        return null;
    }

    /**
     * Checks if a standalone function (not necessarily inline inside
     * `app.get(...)`) is typed as a Hono handler or middleware via imported
     * Hono types or `createMiddleware(...)` / `factory.createHandlers(...)`.
     */
    function inspectStandaloneHandler(fnNode) {
        const parent = fnNode.parent;

        // `createMiddleware((c, next) => ...)` or `factory.createMiddleware(...)`
        if (
            parent?.type === "CallExpression" &&
            isCreateMiddlewareCall(parent) &&
            parent.arguments.includes(fnNode)
        ) {
            return {
                contextParamIndex: 0,
                isMiddleware: true,
                kind: "middleware",
                nextParamIndex: 1
            };
        }

        // `factory.createHandlers((c, next) => ..., (c) => ...)`
        if (
            parent?.type === "CallExpression" &&
            isCreateHandlersCall(parent) &&
            parent.arguments.includes(fnNode)
        ) {
            return {
                contextParamIndex: 0,
                isMiddleware: fnNode.params.length >= 2,
                kind: "handler",
                nextParamIndex: 1
            };
        }

        // Variable typed as `MiddlewareHandler` / `Handler` / `ErrorHandler` / `NotFoundHandler`.
        if (
            parent?.type === "VariableDeclarator" &&
            parent.init === fnNode &&
            parent.id.type === "Identifier" &&
            parent.id.typeAnnotation
        ) {
            const typeName = getTypeReferenceName(parent.id.typeAnnotation);
            if (typeName && handlerTypes.has(typeName)) {
                const isError = typeName === "ErrorHandler";
                const isMiddleware = typeName === "MiddlewareHandler";
                return {
                    contextParamIndex: isError ? 1 : 0,
                    isMiddleware,
                    kind: isMiddleware ? "middleware" : "handler",
                    nextParamIndex: isMiddleware ? 1 : -1
                };
            }
        }

        // Explicit parameter annotations `(c: Context, next: Next) => ...` or `(err: Error, c: Context) => ...`.
        let contextParamIndex = -1;
        let nextParamIndex = -1;
        for (let index = 0; index < fnNode.params.length; index += 1) {
            const param = fnNode.params[index];
            const target =
                param.type === "AssignmentPattern" ? param.left : param;
            if (target.type !== "Identifier" || !target.typeAnnotation) {
                continue;
            }
            const typeName = getTypeReferenceName(target.typeAnnotation);
            if (typeName && contextTypes.has(typeName)) {
                contextParamIndex = index;
            } else if (typeName && nextTypes.has(typeName)) {
                nextParamIndex = index;
            }
        }

        if (contextParamIndex !== -1 || nextParamIndex !== -1) {
            return {
                contextParamIndex,
                isMiddleware: nextParamIndex !== -1,
                kind: nextParamIndex !== -1 ? "middleware" : "handler",
                nextParamIndex
            };
        }

        return null;
    }

    function getTrackedAppNames() {
        const names = new Set();
        for (const info of appBindings.values()) {
            if (info.name && info.name !== "new Hono()") {
                names.add(info.name);
            }
        }
        return names;
    }

    return {
        getAppInfo,
        getMountedPrefixes(appId) {
            return mountedPrefixes.get(appId) ?? new Set();
        },
        getTrackedAppNames,
        handleFunction,
        handleImportDeclaration,
        handleVariableDeclarator,
        hasHonoImport() {
            return hasHonoImport;
        },
        inspectAppCall,
        inspectStandaloneHandler,
        isCreateHandlersCall,
        isCreateMiddlewareCall
    };
}

/** Returns the Identifier node for a function parameter at `index`, or null. */
export function getParamIdentifier(fnNode, index) {
    if (index < 0 || index >= fnNode.params.length) {
        return null;
    }
    const param = fnNode.params[index];
    const target = param.type === "AssignmentPattern" ? param.left : param;
    return target.type === "Identifier" ? target : null;
}
