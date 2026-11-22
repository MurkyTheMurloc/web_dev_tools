/**
 * File overview here, scroll to bottom.
 *
 * Ported from eslint-plugin-solid 0.20.1 (d3e946c). Differences from upstream:
 *
 * - Solid 2.0 only: the 1.x APIs `on`, `observable`, `mergeProps`,
 *   `createResource`, `createMutable`, `createComputed`, `createSelector`,
 *   `indexArray`, `<Index>`, `batch`, `produce`, `onMount`, `onError` and
 *   `useTransition` are not recognized, and neither are
 *   `settings.solid.version` / `moduleSources`.
 * - `createDeferred` returns an accessor, like `createMemo`.
 * - `createEffect`/`createRenderEffect` with a second argument (the split form)
 *   may have an async compute phase, which `reactive-async` models; the apply
 *   phase may also be an effect bundle object.
 * - An uncalled signal passed to a DOM attribute is reported here (upstream hands
 *   that to `no-accessor-as-prop` in v2 mode, which we do not have).
 *
 * @link https://github.com/solidjs-community/eslint-plugin-solid/blob/main/docs/reactivity.md
 */
import { getFunctionHeadLocation } from "@eslint-community/eslint-utils";
import { traverse } from "estraverse";

import {
    findVariable,
    findVariableInScope,
    getScope,
    getSourceCode
} from "../compat.mjs";
import {
    createNameMatcher,
    findParent,
    findInScope,
    isPropsByName,
    isFunctionNode,
    isProgramOrFunctionNode,
    trackImports,
    isDOMElementName,
    ignoreTransparentWrappers,
    getFunctionName,
    isJSXElementOrFragment,
    trace,
    walkOwnBody
} from "../utils.mjs";

class ScopeStackItem {
    /** The node for the current scope, or program if global scope */
    node;
    /**
     * Nodes whose descendants in the current scope are allowed to be reactive.
     * JSXExpressionContainers can be any expression containing reactivity,
     * while function nodes/identifiers are typically arguments to solid-js
     * primitives and should match a tracked scope exactly.
     */
    trackedScopes = [];
    /** Nameless functions with reactivity, should exactly match a tracked scope */
    unnamedDerivedSignals = new Set();
    /** Switched to true by time of :exit if JSX is detected in the current scope */
    hasJSX = false;
    constructor(node) {
        this.node = node;
    }
}
class ScopeStack extends Array {
    currentScope = () => this[this.length - 1];
    parentScope = () => this[this.length - 2];
    /** Add references to a signal, memo, derived signal, etc. */
    pushSignal(variable, declarationScope = this.currentScope().node) {
        this.signals.push({
            references: variable.references.filter(
                (reference) => !reference.init
            ),
            variable,
            declarationScope
        });
    }
    /**
     * Add references to a signal, merging with existing references if the
     * variable is the same. Derived signals are special; they don't use the
     * declaration scope of the function, but rather the minimum declaration
     * scope of any signals they contain.
     */
    pushUniqueSignal(variable, declarationScope) {
        const foundSignal = this.signals.find((s) => s.variable === variable);
        if (!foundSignal) {
            this.pushSignal(variable, declarationScope);
        } else {
            foundSignal.declarationScope = this.findDeepestDeclarationScope(
                foundSignal.declarationScope,
                declarationScope
            );
        }
    }
    /** Add references to a props or store. */
    pushProps(variable, declarationScope = this.currentScope().node) {
        this.props.push({
            references: variable.references.filter(
                (reference) => !reference.init
            ),
            variable,
            declarationScope
        });
    }
    /** Function callbacks that run synchronously and don't create a new scope. */
    syncCallbacks = new Set();
    /**
     * Iterate through and remove the signal references in the current scope.
     * That way, the next Scope up can safely check for references in its
     * scope.
     */
    *consumeSignalReferencesInScope() {
        yield* this.consumeReferencesInScope(this.signals);
        this.signals = this.signals.filter(
            (variable) => variable.references.length !== 0
        );
    }
    /** Iterate through and remove the props references in the current scope. */
    *consumePropsReferencesInScope() {
        yield* this.consumeReferencesInScope(this.props);
        this.props = this.props.filter(
            (variable) => variable.references.length !== 0
        );
    }
    *consumeReferencesInScope(variables) {
        for (const variable of variables) {
            const { references } = variable;
            const inScope = [],
                notInScope = [];
            references.forEach((reference) => {
                if (this.isReferenceInCurrentScope(reference)) {
                    inScope.push(reference);
                } else {
                    notInScope.push(reference);
                }
            });
            yield* inScope.map((reference) => ({
                reference,
                declarationScope: variable.declarationScope
            }));
            // I don't think this is needed! Just a perf optimization
            variable.references = notInScope;
        }
    }
    /**
     * Returns the function node deepest in the tree. Assumes a === b, a is
     * inside b, or b is inside a.
     */
    findDeepestDeclarationScope = (a, b) => {
        if (a === b) return a;
        for (let i = this.length - 1; i >= 0; i -= 1) {
            const { node } = this[i];
            if (a === node || b === node) {
                return node;
            }
        }
        throw new Error("This should never happen");
    };
    /**
     * Returns true if the reference is in the current scope, handling sync
     * callbacks. Must be called on the :exit pass only.
     */
    isReferenceInCurrentScope(reference) {
        let parentFunction = findParent(
            reference.identifier,
            isProgramOrFunctionNode
        );
        while (
            isFunctionNode(parentFunction) &&
            this.syncCallbacks.has(parentFunction)
        ) {
            parentFunction = findParent(
                parentFunction,
                isProgramOrFunctionNode
            );
        }
        return parentFunction === this.currentScope().node;
    }
    /**
     * Variable references to be treated as signals, memos, derived signals,
     * etc.
     */
    signals = [];
    /** Variables references to be treated as props (or stores) */
    props = [];
}
const getNthDestructuredVar = (id, n, context) => {
    if (id?.type === "ArrayPattern") {
        const el = id.elements[n];
        if (el?.type === "Identifier") {
            return findVariable(context, el);
        }
    } else if (id?.type === "ObjectPattern") {
        // {0: a, '1': b, 2: c, ...rest}
        const el = id.properties.find(
            (p) =>
                p.type === "Property" &&
                p.key.type === "Literal" &&
                (p.key.value === n || p.key.value === String(n))
        );
        if (el?.value.type === "Identifier") {
            return findVariable(context, el.value);
        }
    }
    return null;
};
const getReturnedVar = (id, context) => {
    if (id.type === "Identifier") {
        return findVariable(context, id);
    }
    return null;
};
const getStart = (node) => node.range?.[0] ?? node.start;
const getEnd = (node) => node.range?.[1] ?? node.end;
const TIMERS = [
    "setInterval",
    "setTimeout",
    "setImmediate",
    "requestAnimationFrame",
    "requestIdleCallback"
];
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce that reactivity (props, signals, memos, etc.) is properly used, so changes in those values will be tracked and update the view as expected.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/reactivity.md"
        },
        schema: [
            {
                type: "object",
                properties: {
                    customReactiveFunctions: {
                        description:
                            "List of function names to consider as reactive functions (allow signals to be safely passed as arguments). Supports exact names, '*' wildcards ('use*Store'), and regexes given as '/pattern/' strings. In addition, any create* or use* functions are automatically included.",
                        type: "array",
                        items: {
                            type: "string"
                        },
                        default: []
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            noWrite:
                "The reactive variable '{{name}}' should not be reassigned or altered directly.",
            untrackedReactive:
                "The reactive variable '{{name}}' should be used within JSX, a tracked scope (like createEffect), or inside an event handler function, or else changes will be ignored. To keep it reactive, derive it rather than copy it: a plain function, `createMemo`, or `createSignal(() => ...)` / `createStore(() => ...)` for a local override that a new source value should replace.",
            expectedFunctionGotExpression:
                "The reactive variable '{{name}}' should be wrapped in a function for reactivity. This includes event handler bindings on native elements, which are not reactive like other JSX props.",
            handlerBinding:
                "'{{name}}' is read where `{{attribute}}` is bound on a native element. Solid binds the handler once, so `{{expression}}` is evaluated a single time and later changes of '{{name}}' are ignored. Fix: decide inside the handler, `{{attribute}}={{{fix}}}`. Do not wrap the read in `untrack()` and do not disable this rule; neither makes the handler react.",
            badSignal:
                "The reactive variable '{{name}}' should be called as a function when used in {{where}}.",
            badUnnamedDerivedSignal:
                "This function should be passed to a tracked scope (like createEffect) or an event handler because it contains reactivity, or else changes will be ignored.",
            shouldDestructure:
                "For proper analysis, array destructuring should be used to capture the {{nth}}result of this function call.",
            shouldAssign:
                "For proper analysis, a variable should be used to capture the result of this function call.",
            noAsyncTrackedScope:
                "This tracked scope should not be async. Solid's reactivity only tracks synchronously.",
            staleCapture:
                "'{{captured}}' captures the value of the reactive variable '{{name}}' at setup, but a returned function reads the capture later — it will never update. Call '{{name}}' inside the returned function instead, or prefix '{{captured}}' with 'initial'/'default'/'static' if a one-time snapshot is intended.",
            providerValue:
                "A context provider reads its 'value' prop only once, when it is created, so the reactive variable '{{name}}' will not stay up to date here. Pass the signal, memo, or store itself (or an object containing them) instead of reading it in JSX."
        }
    },
    defaultOptions: [
        {
            customReactiveFunctions: []
        }
    ],
    create(context) {
        // `RuleCreator` used to merge `defaultOptions` into `context.options`
        // and hand the result to a second `create` parameter. Without that
        // wrapper the parameter is undefined, so the default is applied here.
        const options = context.options[0] ?? { customReactiveFunctions: [] };

        const warnShouldDestructure = (node, nth) =>
            context.report({
                node,
                messageId: "shouldDestructure",
                data: nth ? { nth: nth + " " } : undefined
            });
        const warnShouldAssign = (node) =>
            context.report({ node, messageId: "shouldAssign" });
        const sourceCode = getSourceCode(context);
        /**
         * Represents the lexical function stack and relevant information for
         * each function
         */
        const scopeStack = new ScopeStack();
        const { currentScope, parentScope } = scopeStack;
        /** Tracks imports from 'solid-js', handling aliases. */
        const { matchImport, handleImportDeclaration } = trackImports();
        /**
         * `customReactiveFunctions` entries may be exact names, glob-ish
         * patterns using `*` wildcards, or regexes written as "/pattern/"
         * strings.
         */
        const matchesCustomReactive = createNameMatcher(
            options.customReactiveFunctions ?? []
        );
        /**
         * JSXExpressionContainers for `value={...}` props on context providers.
         * Providers read `props.value` once, untracked, when created, so
         * reactive expressions here are frozen at their initial value. Recorded
         * so reads inside them get a specific error message instead of the
         * generic untracked-reactivity one.
         */
        const providerValueContainers = new WeakSet();
        /**
         * Returns whether a name resolves to the result of a `createContext()`
         * call in scope.
         */
        const isCreatedContext = (name, refNode) => {
            const variable = findVariableInScope(
                getScope(context, refNode),
                name
            );
            const def = variable?.defs[0];
            return Boolean(
                def &&
                def.node.type === "VariableDeclarator" &&
                def.node.init?.type === "CallExpression" &&
                def.node.init.callee.type === "Identifier" &&
                matchImport("createContext", def.node.init.callee.name)
            );
        };
        /**
         * Detects JSX element names that are context providers:
         * `<SomeContext.Provider>` and `<SomeProvider>` by convention, plus any
         * name resolving to a `createContext()` call — in Solid 2.0 the context
         * object is used directly as the provider (`<MyContext value={}>`).
         */
        const isProviderElementName = (name) => {
            if (name.type === "JSXIdentifier") {
                return (
                    name.name.endsWith("Provider") ||
                    isCreatedContext(name.name, name)
                );
            }
            if (name.type === "JSXMemberExpression") {
                return name.property.name === "Provider";
            }
            return false;
        };
        /**
         * Async/generator functions that are tracked scopes for Solid 2.0 async
         * computations (async createMemo, function-form
         * createSignal/createStore, etc.). Only reads before the first
         * suspension point (`await`/`yield`) are tracked; later reads are
         * reported.
         */
        const asyncTrackedScopes = new Set();
        const suspensionTaintCache = new Map();
        /**
         * If `fn` is an async computation, returns the source position after
         * which reactive reads are no longer tracked, or null if it never
         * suspends. When the first suspension point is inside a loop, the loop
         * is tainted too, since later iterations read after the previous
         * iteration's suspension.
         */
        const getSuspensionTaint = (fn) => {
            if (!isFunctionNode(fn) || !asyncTrackedScopes.has(fn)) return null;
            if (suspensionTaintCache.has(fn)) {
                return suspensionTaintCache.get(fn);
            }
            // Nested functions suspend independently.
            let suspension = null;
            if (!isFunctionNode(fn.body)) {
                walkOwnBody(fn.body, (node) => {
                    if (
                        (node.type === "AwaitExpression" ||
                            node.type === "YieldExpression") &&
                        (suspension === null ||
                            getStart(node) < getStart(suspension))
                    ) {
                        suspension = node;
                    }
                });
            }
            let taint = null;
            if (suspension) {
                // the operands of the first suspension point are still evaluated synchronously
                taint = getEnd(suspension);
                let ancestor = suspension.parent;
                while (ancestor && ancestor !== fn) {
                    if (
                        ancestor.type === "ForStatement" ||
                        ancestor.type === "WhileStatement" ||
                        ancestor.type === "DoWhileStatement"
                    ) {
                        taint = getStart(ancestor);
                    } else if (
                        ancestor.type === "ForOfStatement" ||
                        ancestor.type === "ForInStatement"
                    ) {
                        // the iterated expression is only evaluated once, before the first suspension
                        taint = getStart(ancestor.body);
                    }
                    ancestor = ancestor.parent;
                }
            }
            suspensionTaintCache.set(fn, taint);
            return taint;
        };
        /** Workaround for #61 */
        const markPropsOnCondition = (node, cb) => {
            if (
                node.params.length === 1 &&
                node.params[0].type === "Identifier" &&
                node.parent?.type !== "JSXExpressionContainer" && // "render props" aren't components
                node.parent?.type !== "TemplateLiteral" && // inline functions in tagged template literals aren't components
                cb(node.params[0])
            ) {
                // This function is a component, consider its parameter a props
                const propsParam = findVariable(context, node.params[0]);
                if (propsParam) {
                    scopeStack.pushProps(propsParam, node);
                }
            }
        };
        /** Populates the function stack. */
        const onFunctionEnter = (node) => {
            if (isFunctionNode(node)) {
                if (scopeStack.syncCallbacks.has(node)) {
                    // Ignore sync callbacks like Array#forEach and certain Solid primitives
                    return;
                }
                markPropsOnCondition(node, (props) =>
                    isPropsByName(props.name)
                );
            }
            scopeStack.push(new ScopeStackItem(node));
        };
        /**
         * Returns whether a node falls under a tracked scope in the current
         * function scope
         */
        const matchTrackedScope = (trackedScope, node) => {
            switch (trackedScope.expect) {
                case "function":
                case "called-function":
                    return node === trackedScope.node;
                case "expression":
                    return Boolean(
                        findInScope(
                            node,
                            currentScope().node,
                            (node) => node === trackedScope.node
                        )
                    );
            }
        };
        /**
         * Returns true when `fn` is directly returned by the enclosing
         * function: either the argument of a `return` statement or the whole
         * body of an arrow function. Deliberately strict — a function that
         * merely appears somewhere inside a returned expression (e.g. a
         * runWithOwner callback in a returned call) is not "returned" for our
         * purposes.
         */
        const isDirectlyReturned = (fn) =>
            fn.parent?.type === "ReturnStatement" ||
            (fn.parent?.type === "ArrowFunctionExpression" &&
                fn.parent.body === fn);
        /**
         * Returns the parent of `fn` for the object-property exemption, looking
         * through conditional/logical wrappers that only decide _whether_ the
         * function is used, not _where_ it lands: `{ onDrag: props.onDrag ? (e)
         * => props.onDrag(e) : undefined }` or `{ onDrag: props.onDrag && ((e)
         * => props.onDrag(e)) }` classify the same as the unconditional form
         * (#235). Functions in a conditional's _test_ are actually called to
         * decide, so they are not looked through.
         */
        const getEffectivePropertyParent = (fn) => {
            let child = fn;
            let parent = fn.parent ?? null;
            while (
                parent &&
                ((parent.type === "ConditionalExpression" &&
                    child !== parent.test) ||
                    (parent.type === "LogicalExpression" &&
                        child === parent.right))
            ) {
                child = parent;
                parent = parent.parent ?? null;
            }
            return parent;
        };
        const isReferenceReturned = (node, boundary) => {
            let cursor = node.parent ?? null;
            while (cursor && cursor !== boundary) {
                if (cursor.type === "ReturnStatement") return true;
                if (
                    cursor.type === "CallExpression" ||
                    cursor.type === "NewExpression" ||
                    isFunctionNode(cursor)
                ) {
                    return false;
                }
                cursor = cursor.parent ?? null;
            }
            return false;
        };
        const isDeclaredClosureReturned = (closure, boundary) => {
            const declaration =
                closure.type === "FunctionDeclaration"
                    ? closure
                    : closure.parent?.type === "VariableDeclarator" &&
                        closure.parent.init === closure
                      ? closure.parent
                      : null;
            if (!declaration) return false;
            const variables =
                sourceCode.scopeManager?.getDeclaredVariables(declaration) ??
                [];
            return variables.some((variable) =>
                variable.references.some(
                    (reference) =>
                        !reference.init &&
                        isReferenceReturned(reference.identifier, boundary)
                )
            );
        };
        /**
         * Returns true when `node` sits inside a nested function that escapes
         * the `boundary` function through a `return` statement (including
         * functions embedded in returned JSX or objects).
         */
        const isCapturedInReturnedFunction = (node, boundary) => {
            // Find the outermost function strictly inside `boundary` containing `node`.
            let outermost = null;
            let cursor = node;
            while (cursor && cursor !== boundary) {
                if (isFunctionNode(cursor)) outermost = cursor;
                cursor = cursor.parent ?? null;
            }
            if (!cursor || !outermost) return false; // not under boundary, or not captured by a closure
            // Walk from that function to `boundary`; only non-function nodes remain
            // in between, so a ReturnStatement found here belongs to `boundary`.
            let child = outermost;
            let parent = child.parent ?? null;
            while (parent && child !== boundary) {
                if (parent.type === "ReturnStatement") return true;
                // A function passed as a call argument doesn't escape through a
                // `return` below it — only the call's *result* does. Synchronous
                // callbacks (`return items.filter((item) => item.includes(q))`) run
                // during the computation, where the capture is fresh (#223). The
                // same goes for a called function itself (IIFEs).
                if (
                    parent.type === "CallExpression" ||
                    parent.type === "NewExpression"
                ) {
                    return false;
                }
                if (isFunctionNode(parent)) {
                    if (
                        parent === boundary &&
                        child.type === "BlockStatement" &&
                        isDeclaredClosureReturned(outermost, boundary)
                    ) {
                        return true;
                    }
                    return (
                        parent === boundary &&
                        parent.type === "ArrowFunctionExpression" &&
                        parent.body === child &&
                        // only an expression body is an implicit return; a closure declared as a
                        // statement in a block body is not returned (#250)
                        child.type !== "BlockStatement"
                    );
                }
                child = parent;
                parent = parent.parent ?? null;
            }
            return false;
        };
        /**
         * Detects the stale-capture footgun: a signal called at a function's
         * setup level, its result captured in a variable, and that variable
         * read by a function the enclosing function _returns_. The returned
         * function pretends to be live but reads a value frozen at setup.
         * Reports and returns true when found.
         */
        const checkStaleCapture = (identifier) => {
            const call = identifier.parent;
            if (call?.type !== "CallExpression" || call.callee !== identifier) {
                return false;
            }
            // Find the VariableDeclarator whose init contains this call, walking up
            // through intermediate expressions (`const t = items().length`) but
            // never through a statement or another function.
            let child = call;
            while (
                child.parent &&
                child.parent.type !== "VariableDeclarator" &&
                !isFunctionNode(child.parent) &&
                !child.parent.type.endsWith("Statement")
            ) {
                child = child.parent;
            }
            const declarator = child.parent;
            if (
                declarator?.type !== "VariableDeclarator" ||
                declarator.init !== child
            ) {
                return false;
            }
            const currentScopeNode = currentScope().node;
            const capturedVars =
                sourceCode.scopeManager?.getDeclaredVariables(declarator) ?? [];
            for (const captured of capturedVars) {
                // The initial/default/static naming convention opts into a one-time
                // snapshot, same as for props reads.
                if (/^(?:initial|default|static[A-Z])/.test(captured.name)) {
                    continue;
                }
                for (const reference of captured.references) {
                    if (reference.init) continue;
                    if (
                        isCapturedInReturnedFunction(
                            reference.identifier,
                            currentScopeNode
                        )
                    ) {
                        context.report({
                            node: call,
                            messageId: "staleCapture",
                            data: {
                                name: identifier.name,
                                captured: captured.name
                            }
                        });
                        return true;
                    }
                }
            }
            return false;
        };
        /**
         * Inspects a specific reference of a reactive variable for correct
         * handling.
         */
        const handleTrackedScopes = (identifier, declarationScope) => {
            const currentScopeNode = currentScope().node;
            // Check if the call falls outside any tracked scopes in the current scope
            if (
                !currentScope().trackedScopes.find((trackedScope) =>
                    matchTrackedScope(trackedScope, identifier)
                )
            ) {
                const matchedExpression = currentScope().trackedScopes.find(
                    (trackedScope) =>
                        matchTrackedScope(
                            { ...trackedScope, expect: "expression" },
                            identifier
                        )
                );
                if (declarationScope === currentScopeNode) {
                    // If the reactivity is not contained in a tracked scope, and any of
                    // the reactive variables were declared in the current scope, then we
                    // report them. When the reference is to an object in a
                    // MemberExpression (props/store) or a function call (signal), report
                    // that, otherwise the identifier.
                    let parentMemberExpression = null;
                    if (identifier.parent?.type === "MemberExpression") {
                        parentMemberExpression = identifier.parent;
                        while (
                            parentMemberExpression.parent?.type ===
                            "MemberExpression"
                        ) {
                            parentMemberExpression =
                                parentMemberExpression.parent;
                        }
                    }
                    const parentCallExpression =
                        identifier.parent?.type === "CallExpression"
                            ? identifier.parent
                            : null;
                    // Reads inside a context provider's `value={...}` get a specific message; the
                    // value is read once, untracked, when the provider is created.
                    const inProviderValue = Boolean(
                        findParent(identifier, (n) =>
                            providerValueContainers.has(n)
                        )
                    );
                    // An `on*` handler on a native element is bound once; name
                    // the attribute and the fix.
                    const handlerAttribute = matchedExpression
                        ? findParent(identifier, (n) => {
                              return (
                                  n.type === "JSXAttribute" &&
                                  n.name.type === "JSXIdentifier" &&
                                  /^on[A-Z]/u.test(n.name.name) &&
                                  n.parent?.name?.type === "JSXIdentifier" &&
                                  isDOMElementName(n.parent.name.name)
                              );
                          })
                        : null;
                    const handlerExpression =
                        handlerAttribute?.value?.type ===
                        "JSXExpressionContainer"
                            ? handlerAttribute.value.expression
                            : null;
                    const handlerText = handlerExpression
                        ? sourceCode.getText(handlerExpression)
                        : "";
                    // A copyable replacement with the code's own names.
                    let handlerFix = `(event) => (${handlerText})(event)`;
                    if (handlerExpression?.type === "ConditionalExpression") {
                        handlerFix = `(event) => (${handlerText})?.(event)`;
                    } else if (
                        handlerExpression?.type === "LogicalExpression" &&
                        handlerExpression.operator === "&&"
                    ) {
                        const { left, right } = handlerExpression;
                        const callee =
                            right.type === "Identifier"
                                ? right.name
                                : `(${sourceCode.getText(right)})`;
                        handlerFix = `(event) => { if (${sourceCode.getText(left)}) ${callee}(event); }`;
                    }
                    let messageId = "untrackedReactive";
                    if (inProviderValue) {
                        messageId = "providerValue";
                    } else if (handlerAttribute) {
                        messageId = "handlerBinding";
                    } else if (matchedExpression) {
                        messageId = "expectedFunctionGotExpression";
                    }
                    context.report({
                        node:
                            parentMemberExpression ??
                            parentCallExpression ??
                            identifier,
                        messageId,
                        data: {
                            attribute: handlerAttribute?.name.name,
                            expression: handlerText,
                            fix: handlerFix,
                            name: parentMemberExpression
                                ? sourceCode.getText(parentMemberExpression)
                                : identifier.name
                        }
                    });
                } else {
                    // If all of the reactive variables were declared above the current
                    // function scope, then the entire function becomes reactive with the
                    // deepest declaration scope of the reactive variables it contains.
                    // Let the next onFunctionExit up handle it.
                    if (!parentScope() || !isFunctionNode(currentScopeNode)) {
                        throw new Error("this shouldn't happen!");
                    }
                    // Signal called at this function's setup level with its value
                    // captured by a variable that a *returned* function reads: the
                    // returned function will read a stale value forever. Report here —
                    // treating the enclosing function as a derived signal (below) is
                    // still correct, but no call-site discipline can fix the capture.
                    checkStaleCapture(identifier);
                    // If the current function doesn't have an associated variable, that's
                    // fine, it's being used inline (i.e. anonymous arrow function). For
                    // this to be okay, the arrow function has to be the same node as one
                    // of the tracked scopes, as we can't easily find references.
                    const pushUnnamedDerivedSignal = () =>
                        (parentScope().unnamedDerivedSignals ??= new Set()).add(
                            currentScopeNode
                        );
                    if (isDirectlyReturned(currentScopeNode)) {
                        // A function directly returned by its enclosing function is an
                        // accessor handed to the caller — the custom-primitive contract.
                        // The caller decides whether it lands in a tracked scope; there is
                        // nowhere in this file for it to match a tracked scope, so
                        // requiring one only punishes the idiomatic hook shape
                        // (`return () => signal()`). Do nothing.
                    } else if (
                        currentScopeNode.type === "FunctionDeclaration"
                    ) {
                        // get variable representing function, function node only defines one variable
                        const functionVariable =
                            sourceCode.scopeManager?.getDeclaredVariables(
                                currentScopeNode
                            )?.[0];
                        if (functionVariable) {
                            scopeStack.pushUniqueSignal(
                                functionVariable,
                                declarationScope // use declaration scope of a signal contained in this function
                            );
                        } else {
                            pushUnnamedDerivedSignal();
                        }
                    } else if (
                        currentScopeNode.parent?.type === "VariableDeclarator"
                    ) {
                        const declarator = currentScopeNode.parent;
                        // for nameless or arrow function expressions, use the declared variable it's assigned to
                        const functionVariable =
                            sourceCode.scopeManager?.getDeclaredVariables(
                                declarator
                            )?.[0];
                        if (functionVariable) {
                            // use declaration scope of a signal contained in this scope, not the function itself
                            scopeStack.pushUniqueSignal(
                                functionVariable,
                                declarationScope
                            );
                        } else {
                            pushUnnamedDerivedSignal();
                        }
                    } else if (
                        getEffectivePropertyParent(currentScopeNode)?.type ===
                        "Property"
                    ) {
                        // todo make this a unique props or something--for now, just ignore (unsafe)
                    } else {
                        pushUnnamedDerivedSignal();
                    }
                }
            }
        };
        /** Performs all analysis and reporting. */
        const onFunctionExit = (currentScopeNode) => {
            // If this function is a component, add its props as a reactive variable
            if (isFunctionNode(currentScopeNode)) {
                markPropsOnCondition(currentScopeNode, (props) => {
                    if (
                        !isPropsByName(props.name) && // already added in markPropsOnEnter
                        currentScope().hasJSX
                    ) {
                        const functionName = getFunctionName(currentScopeNode);
                        // begins with lowercase === not component
                        if (functionName && !/^[a-z]/.test(functionName))
                            return true;
                    }
                    return false;
                });
            }
            // Ignore sync callbacks like Array#forEach and certain Solid primitives.
            // In this case only, currentScopeNode !== currentScope().node, but we're
            // returning early so it doesn't matter.
            if (
                isFunctionNode(currentScopeNode) &&
                scopeStack.syncCallbacks.has(currentScopeNode)
            ) {
                return;
            }
            // If this scope is an async computation (Solid 2.0), reactive reads positioned
            // after its first suspension point resume outside the tracking window.
            const suspensionTaint = getSuspensionTaint(currentScopeNode);
            const isReadAfterSuspension = (identifier) =>
                suspensionTaint != null &&
                getStart(identifier) >= suspensionTaint;
            // Reads after the first `await` are reported by `reactive-async`,
            // which follows the runtime's UNTRACKED_READ_AFTER_AWAIT; here they
            // are only kept out of the tracked-scope analysis.
            // Iterate through all usages of (derived) signals in the current scope
            for (const {
                reference,
                declarationScope
            } of scopeStack.consumeSignalReferencesInScope()) {
                const identifier = reference.identifier;
                if (reference.isWrite()) {
                    // don't allow reassigning signals
                    context.report({
                        node: identifier,
                        messageId: "noWrite",
                        data: {
                            name: identifier.name
                        }
                    });
                } else if (identifier.type === "Identifier") {
                    const reportBadSignal = (where) =>
                        context.report({
                            node: identifier,
                            messageId: "badSignal",
                            data: { name: identifier.name, where }
                        });
                    if (
                        // This allows both calling a signal and calling a function with a signal.
                        identifier.parent?.type === "CallExpression" ||
                        // Also allow the case where we pass an array of signals, such as in a custom hook
                        (identifier.parent?.type === "ArrayExpression" &&
                            identifier.parent.parent?.type === "CallExpression")
                    ) {
                        if (!isReadAfterSuspension(identifier)) {
                            // This signal is getting called properly, analyze it.
                            handleTrackedScopes(identifier, declarationScope);
                        }
                    } else if (identifier.parent?.type === "TemplateLiteral") {
                        reportBadSignal("template literals");
                    } else if (
                        identifier.parent?.type === "BinaryExpression" &&
                        [
                            "<",
                            "<=",
                            ">",
                            ">=",
                            "<<",
                            ">>",
                            ">>>",
                            "+",
                            "-",
                            "*",
                            "/",
                            "%",
                            "**",
                            "|",
                            "^",
                            "&",
                            "in"
                        ].includes(identifier.parent.operator)
                    ) {
                        // We're in an arithmetic/comparison expression where using an uncalled signal wouldn't make sense
                        reportBadSignal("arithmetic or comparisons");
                    } else if (
                        identifier.parent?.type === "UnaryExpression" &&
                        ["-", "+", "~"].includes(identifier.parent.operator)
                    ) {
                        // We're in a unary expression where using an uncalled signal wouldn't make sense
                        reportBadSignal("unary expressions");
                    } else if (
                        identifier.parent?.type === "MemberExpression" &&
                        identifier.parent.computed &&
                        identifier.parent.property === identifier
                    ) {
                        // We're using an uncalled signal to index an object or array, which doesn't make sense
                        reportBadSignal("property accesses");
                    } else if (
                        identifier.parent?.type === "JSXExpressionContainer" &&
                        !currentScope().trackedScopes.find(
                            (trackedScope) =>
                                trackedScope.node === identifier &&
                                (trackedScope.expect === "function" ||
                                    trackedScope.expect === "called-function")
                        )
                    ) {
                        // If the signal is in a JSXExpressionContainer that's also marked as a "function" or "called-function" tracked scope,
                        // let it be.
                        const elementOrAttribute = identifier.parent.parent;
                        if (
                            // The signal is not being called and is being used as a props.children, where calling
                            // the signal was the likely intent.
                            isJSXElementOrFragment(elementOrAttribute) ||
                            // We can't say for sure about user components, but we know for a fact that a signal
                            // should not be passed to a non-event handler DOM element attribute without calling it.
                            (elementOrAttribute?.type === "JSXAttribute" &&
                                elementOrAttribute.parent?.type ===
                                    "JSXOpeningElement" &&
                                elementOrAttribute.parent.name.type ===
                                    "JSXIdentifier" &&
                                isDOMElementName(
                                    elementOrAttribute.parent.name.name
                                ))
                        ) {
                            reportBadSignal("JSX");
                        }
                    }
                }
                // The signal is being read outside of a CallExpression. Since
                // there's a lot of possibilities here and they're generally fine,
                // do nothing.
            }
            // Do a similar thing with all usages of props in the current function
            for (const {
                reference,
                declarationScope
            } of scopeStack.consumePropsReferencesInScope()) {
                const identifier = reference.identifier;
                if (reference.isWrite()) {
                    // don't allow reassigning props or stores
                    context.report({
                        node: identifier,
                        messageId: "noWrite",
                        data: {
                            name: identifier.name
                        }
                    });
                } else if (
                    identifier.parent?.type === "MemberExpression" &&
                    identifier.parent.object === identifier
                ) {
                    const { parent } = identifier;
                    if (
                        parent.parent?.type === "AssignmentExpression" &&
                        parent.parent.left === parent
                    ) {
                        // don't allow writing to props or stores directly
                        context.report({
                            node: identifier,
                            messageId: "noWrite",
                            data: {
                                name: identifier.name
                            }
                        });
                    } else if (
                        parent.property.type === "Identifier" &&
                        /^(?:initial|default|static[A-Z])/.test(
                            parent.property.name
                        )
                    ) {
                        // We're using a prop with a name that starts with `initial` or
                        // `default`, like `props.initialCount`. We'll refrain from warning
                        // about untracked usages of these props, because the user has shown
                        // that they understand the consequences of using a reactive
                        // variable to initialize something else. Do nothing.
                    } else if (!isReadAfterSuspension(identifier)) {
                        // The props are the object in a property read access, which
                        // should be under a tracked scope.
                        handleTrackedScopes(identifier, declarationScope);
                    }
                } else if (
                    identifier.type === "Identifier" &&
                    (identifier.parent?.type === "AssignmentExpression" ||
                        identifier.parent?.type === "VariableDeclarator")
                ) {
                    if (
                        identifier.parent.type === "AssignmentExpression" &&
                        identifier.parent.right === identifier &&
                        identifier.parent.left.type === "MemberExpression"
                    ) {
                        // `this.state = state` stores a *reference* to the proxy, not a
                        // snapshot: property reads through it are still reactive at read
                        // time. The alias escapes local analysis exactly like passing the
                        // proxy as a call argument, which is already permitted (#184).
                        // Do nothing.
                    } else {
                        // `... = props` is usually destructuring, which snapshots values instead of
                        // staying reactive. Inside a tracked scope (or a function passed to one) the
                        // destructuring re-runs on updates, so defer to the same analysis as reads.
                        handleTrackedScopes(identifier, declarationScope);
                    }
                }
                // The props are being read, but not in a MemberExpression. Since
                // there's a lot of possibilities here and they're generally fine,
                // do nothing.
            }
            // If there are any unnamed derived signals, they must match a tracked
            // scope. Usually anonymous arrow function args to createEffect,
            // createMemo, etc.
            const { unnamedDerivedSignals } = currentScope();
            if (unnamedDerivedSignals) {
                for (const node of unnamedDerivedSignals) {
                    if (
                        !currentScope().trackedScopes.find((trackedScope) =>
                            matchTrackedScope(trackedScope, node)
                        )
                    ) {
                        context.report({
                            loc: getFunctionHeadLocation(node, sourceCode),
                            messageId: "badUnnamedDerivedSignal"
                        });
                    }
                }
            }
            // Pop on exit
            scopeStack.pop();
        };
        /*
         * Sync array functions (forEach, map, reduce, reduceRight, flatMap),
         * store update fn params (ex. setState("todos", (t) => [...t.slice(0, i()),
         * ...t.slice(i() + 1)])), flush, and maybe a few others don't actually
         * create a new scope. That is, any signal/prop accesses in these
         * functions act as if they happen in the enclosing function. Note that
         * this means whether or not the enclosing function is a tracking scope
         * applies to the fn param as well.
         *
         * Every time a sync callback is detected, we put that function node into a
         * syncCallbacks Set<FunctionNode>. The detections must happen on the entry pass
         * and when the function node has not yet been traversed. In onFunctionEnter, if
         * the function node is in syncCallbacks, we don't push it onto the
         * scopeStack. In onFunctionExit, if the function node is in syncCallbacks,
         * we don't pop scopeStack.
         */
        const checkForSyncCallbacks = (node) => {
            if (
                node.arguments.length === 1 &&
                isFunctionNode(node.arguments[0]) &&
                !node.arguments[0].async
            ) {
                if (
                    node.callee.type === "Identifier" &&
                    matchImport(["flush"], node.callee.name)
                ) {
                    // These Solid APIs take callbacks that run in the current scope
                    scopeStack.syncCallbacks.add(node.arguments[0]);
                } else if (
                    node.callee.type === "MemberExpression" &&
                    !node.callee.computed &&
                    node.callee.object.type !== "ObjectExpression" &&
                    /^(?:forEach|map|flatMap|reduce|reduceRight|find|findIndex|filter|every|some)$/.test(
                        node.callee.property.name
                    )
                ) {
                    // These common array methods (or likely array methods) take synchronous callbacks
                    scopeStack.syncCallbacks.add(node.arguments[0]);
                }
            }
            if (
                // Array.from(iterable, mapFn) calls mapFn synchronously (#250)
                node.callee.type === "MemberExpression" &&
                !node.callee.computed &&
                node.callee.object.type === "Identifier" &&
                node.callee.object.name === "Array" &&
                node.callee.property.type === "Identifier" &&
                node.callee.property.name === "from" &&
                isFunctionNode(node.arguments[1]) &&
                !node.arguments[1].async
            ) {
                scopeStack.syncCallbacks.add(node.arguments[1]);
            }
            if (node.callee.type === "Identifier") {
                if (
                    matchImport(
                        [
                            "createSignal",
                            "createStore",
                            "createOptimistic",
                            "createOptimisticStore"
                        ],
                        node.callee.name
                    ) &&
                    node.parent?.type === "VariableDeclarator"
                ) {
                    // Allow using reactive variables in state setter if the current scope is tracked.
                    // ex.  const [state, setState] = createStore({ ... });
                    //      setState(() => ({ preferredName: state.firstName, lastName: "Milner" }));
                    const setter = getNthDestructuredVar(
                        node.parent.id,
                        1,
                        context
                    );
                    if (setter) {
                        for (const reference of setter.references) {
                            const { identifier } = reference;
                            if (
                                !reference.init &&
                                reference.isRead() &&
                                identifier.parent?.type === "CallExpression"
                            ) {
                                for (const arg of identifier.parent.arguments) {
                                    if (isFunctionNode(arg) && !arg.async) {
                                        scopeStack.syncCallbacks.add(arg);
                                    }
                                }
                            }
                        }
                    }
                } else if (
                    matchImport(["mapArray", "repeat"], node.callee.name)
                ) {
                    const arg1 = node.arguments[1];
                    if (isFunctionNode(arg1)) {
                        scopeStack.syncCallbacks.add(arg1);
                    }
                }
            }
            // Handle IIFEs
            if (isFunctionNode(node.callee)) {
                scopeStack.syncCallbacks.add(node.callee);
            }
        };
        /**
         * Checks VariableDeclarators, AssignmentExpressions, and
         * CallExpressions for reactivity.
         */
        const checkForReactiveAssignment = (id, init) => {
            init = ignoreTransparentWrappers(init);
            // Mark return values of certain functions as reactive
            if (
                init.type === "CallExpression" &&
                init.callee.type === "Identifier"
            ) {
                const { callee } = init;
                if (
                    matchImport(
                        ["createSignal", "createOptimistic"],
                        callee.name
                    )
                ) {
                    const signal = id && getNthDestructuredVar(id, 0, context);
                    if (signal) {
                        scopeStack.pushSignal(signal, currentScope().node);
                    } else {
                        warnShouldDestructure(id ?? init, "first");
                    }
                } else if (
                    matchImport(["createMemo", "createDeferred"], callee.name)
                ) {
                    const memo = id && getReturnedVar(id, context);
                    // memos act like signals
                    if (memo) {
                        scopeStack.pushSignal(memo, currentScope().node);
                    } else {
                        warnShouldAssign(id ?? init);
                    }
                } else if (
                    matchImport(
                        ["createStore", "createOptimisticStore"],
                        callee.name
                    )
                ) {
                    const store = id && getNthDestructuredVar(id, 0, context);
                    // stores act like props
                    if (store) {
                        scopeStack.pushProps(store, currentScope().node);
                    } else {
                        warnShouldDestructure(id ?? init, "first");
                    }
                } else if (matchImport(["merge", "omit"], callee.name)) {
                    // omit (which replaces splitProps) also returns a single props object
                    const merged = id && getReturnedVar(id, context);
                    if (merged) {
                        scopeStack.pushProps(merged, currentScope().node);
                    } else {
                        warnShouldAssign(id ?? init);
                    }
                } else if (matchImport("splitProps", callee.name)) {
                    // splitProps can return an unbounded array of props variables, though it's most often two
                    if (id?.type === "ArrayPattern") {
                        const vars = id.elements
                            .map((_, i) =>
                                getNthDestructuredVar(id, i, context)
                            )
                            .filter(Boolean);
                        if (vars.length === 0) {
                            warnShouldDestructure(id);
                        } else {
                            vars.forEach((variable) => {
                                scopeStack.pushProps(
                                    variable,
                                    currentScope().node
                                );
                            });
                        }
                    } else {
                        // if it's returned as an array, treat that as a props object
                        const vars = id && getReturnedVar(id, context);
                        if (vars) {
                            scopeStack.pushProps(vars, currentScope().node);
                        }
                    }
                } else if (matchImport("createProjection", callee.name)) {
                    // createProjection returns a readonly derived store
                    const projection = id && getReturnedVar(id, context);
                    if (projection) {
                        scopeStack.pushProps(projection, currentScope().node);
                    }
                } else if (matchImport("mapArray", callee.name)) {
                    const arg1 = init.arguments[1];
                    if (
                        isFunctionNode(arg1) &&
                        arg1.params.length >= 2 &&
                        arg1.params[1].type === "Identifier"
                    ) {
                        const indexSignal = findVariable(
                            context,
                            arg1.params[1]
                        );
                        if (indexSignal) {
                            scopeStack.pushSignal(indexSignal);
                        }
                    }
                }
            }
        };
        const checkForTrackedScopes = (node) => {
            const pushTrackedScope = (node, expect, allowAsync = false) => {
                currentScope().trackedScopes.push({ node, expect });
                if (
                    expect !== "called-function" &&
                    isFunctionNode(node) &&
                    (node.async || node.generator)
                ) {
                    if (allowAsync) {
                        // Async computations are first-class in Solid 2.0 (async createMemo,
                        // function-form createSignal/createStore, etc.). Reads before the first
                        // suspension point are tracked normally; reads after it get a targeted
                        // reactive-async report on reads after the first await instead of a blanket warning.
                        asyncTrackedScopes.add(node);
                    } else if (node.async) {
                        // "[Solid's] approach only tracks synchronously. If you have a
                        // setTimeout or use an async function in your Effect the code that
                        // executes async after the fact won't be tracked."
                        context.report({
                            node,
                            messageId: "noAsyncTrackedScope"
                        });
                    }
                }
            };
            // given some expression, mark any functions within it as tracking scopes, and do not traverse
            // those functions
            const permissivelyTrackNode = (node) => {
                traverse(node, {
                    enter(cn) {
                        const childNode = cn;
                        const traced = trace(childNode, context);
                        // when referencing a function or something that could be a derived signal, track it
                        if (
                            isFunctionNode(traced) ||
                            (traced.type === "Identifier" &&
                                traced.parent.type !== "MemberExpression" &&
                                !(
                                    traced.parent.type === "CallExpression" &&
                                    traced.parent.callee === traced
                                )) ||
                            // memo accessors traced to their initializing call, e.g. passing a variable
                            // holding a createMemo result — treat like passing a signal
                            (traced.type === "CallExpression" &&
                                traced.callee.type === "Identifier" &&
                                matchImport(
                                    [
                                        "createMemo",
                                        "createDeferred",
                                        "children",
                                        "createProjection"
                                    ],
                                    traced.callee.name
                                ))
                        ) {
                            pushTrackedScope(childNode, "called-function");
                            this.skip(); // poor-man's `findInScope`: don't enter child scopes
                        }
                    },
                    fallback: "iteration" // Don't crash when encounter unknown node.
                });
            };
            if (node.type === "JSXExpressionContainer") {
                if (
                    node.parent?.type === "JSXAttribute" &&
                    sourceCode.getText(node.parent.name).startsWith("on") &&
                    node.parent.parent?.type === "JSXOpeningElement" &&
                    node.parent.parent.name.type === "JSXIdentifier" &&
                    isDOMElementName(node.parent.parent.name.name)
                ) {
                    // Expect a function if the attribute is like onClick={}, onclick={}, on:click={}, or
                    // custom events such as on-click={}.
                    // From the docs:
                    // Events are never rebound and the bindings are not reactive, as it is expensive to
                    // attach and detach listeners. Since event handlers are called like any other function
                    // each time an event fires, there is no need for reactivity; simply shortcut your handler
                    // if desired.
                    // What this means here is we actually do consider an event handler a tracked scope
                    // expecting a function, i.e. it's okay to use changing props/signals in the body of the
                    // function, even though the changes don't affect when the handler will run. This is what
                    // "called-function" represents—not quite a tracked scope, but a place where it's okay to
                    // read reactive values.
                    pushTrackedScope(node.expression, "called-function");
                } else if (
                    node.parent?.type === "JSXAttribute" &&
                    node.parent.name.type === "JSXNamespacedName" &&
                    node.parent.name.namespace.name === "use" &&
                    isFunctionNode(node.expression)
                ) {
                    // With a `use:` hook, assume that a function passed is a called function.
                    pushTrackedScope(node.expression, "called-function");
                } else if (
                    node.parent?.type === "JSXAttribute" &&
                    node.parent.name.name === "value" &&
                    node.parent.parent?.type === "JSXOpeningElement" &&
                    isProviderElementName(node.parent.parent.name)
                ) {
                    // Context providers read `props.value` once, untracked, when they are created, so
                    // a reactive expression here is frozen at its initial value. Don't push a tracked
                    // scope; record the container so reads inside it get the specific `providerValue`
                    // message instead of the generic one.
                    providerValueContainers.add(node);
                } else if (
                    node.parent?.type === "JSXAttribute" &&
                    node.parent.name?.type === "JSXIdentifier" &&
                    /^static[A-Z]/.test(node.parent.name.name) &&
                    node.parent.parent?.type === "JSXOpeningElement" &&
                    node.parent.parent.name.type === "JSXIdentifier" &&
                    !isDOMElementName(node.parent.parent.name.name)
                ) {
                    // A caller is passing a value to a prop prefixed with `static` in a component, i.e.
                    // `<Box staticName={...} />`. Since we're considering these props as static in the component
                    // we shouldn't allow passing reactive values to them, as this isn't just ignoring reactivity
                    // like initial*/default*; this is disabling it altogether as a convention. Do nothing.
                } else if (
                    node.parent?.type === "JSXAttribute" &&
                    node.parent.name.name === "ref" &&
                    isFunctionNode(node.expression)
                ) {
                    // Callback/function refs are called when an element is created but before it is connected
                    // to the DOM. This is semantically a "called function", so it's fine to read reactive
                    // variables here.
                    pushTrackedScope(node.expression, "called-function");
                } else if (
                    isJSXElementOrFragment(node.parent) &&
                    isFunctionNode(node.expression)
                ) {
                    pushTrackedScope(node.expression, "function"); // functions inline in JSX containers will be tracked
                } else {
                    pushTrackedScope(node.expression, "expression");
                }
            } else if (node.type === "JSXSpreadAttribute") {
                // allow <div {...props.nestedProps} />; {...props} is already ignored
                pushTrackedScope(node.argument, "expression");
            } else if (node.type === "NewExpression") {
                const {
                    callee,
                    arguments: { 0: arg0 }
                } = node;
                if (
                    callee.type === "Identifier" &&
                    arg0 &&
                    // Observers from Standard Web APIs
                    [
                        "IntersectionObserver",
                        "MutationObserver",
                        "PerformanceObserver",
                        "ReportingObserver",
                        "ResizeObserver"
                    ].includes(callee.name)
                ) {
                    // Observers callbacks are NOT tracked scopes. However, they
                    // don't need to react to updates to reactive variables; it's okay
                    // to poll the current value. Consider them called-function tracked
                    // scopes for our purposes.
                    pushTrackedScope(arg0, "called-function");
                }
            } else if (node.type === "CallExpression") {
                if (node.callee.type === "Identifier") {
                    const {
                        callee,
                        arguments: { 0: arg0, 1: arg1 }
                    } = node;
                    if (
                        matchImport(
                            ["createEffect", "createRenderEffect"],
                            callee.name
                        )
                    ) {
                        // Solid 2.0 split these into `(compute, apply)`. The
                        // compute phase tracks and, like any computation, may
                        // be async (`reactive-async` checks it). A lone function
                        // is reported by no-single-arg-create-effect, whether
                        // async or not. The apply phase runs untracked
                        // and may return a cleanup, so reads there poll rather
                        // than subscribe. `createEffect` also accepts an effect
                        // bundle object in place of a plain apply function.
                        pushTrackedScope(arg0, "function", true);
                        if (arg1) {
                            if (arg1.type === "ObjectExpression") {
                                for (const property of arg1.properties) {
                                    if (
                                        property.type === "Property" &&
                                        isFunctionNode(property.value)
                                    ) {
                                        pushTrackedScope(
                                            property.value,
                                            "called-function"
                                        );
                                    }
                                }
                            } else {
                                pushTrackedScope(arg1, "called-function");
                            }
                        }
                    } else if (
                        matchImport(
                            [
                                "createMemo",
                                "children",
                                "createDeferred",
                                "mapArray",
                                "createTrackedEffect",
                                "isPending",
                                "latest",
                                "resolve",
                                "deep",
                                "repeat",
                                "createErrorBoundary",
                                "createLoadingBoundary",
                                "createRevealOrder",
                                "dynamic",
                                "dynamicComponent",
                                "until"
                            ],
                            callee.name
                        )
                    ) {
                        // createMemo, createDeferred, dynamic, and dynamicComponent may take an
                        // async function; only reads before its first `await` are tracked.
                        // until(fn) tracks its predicate until it is truthy.
                        pushTrackedScope(
                            arg0,
                            "function",
                            Boolean(
                                matchImport(
                                    [
                                        "createMemo",
                                        "createDeferred",
                                        "dynamic",
                                        "dynamicComponent"
                                    ],
                                    callee.name
                                )
                            )
                        );
                        if (
                            matchImport(
                                [
                                    "createErrorBoundary",
                                    "createLoadingBoundary"
                                ],
                                callee.name
                            ) &&
                            arg1
                        ) {
                            // Boundary fallbacks are reactive accessors; the error fallback
                            // also receives (err, reset) arguments
                            pushTrackedScope(arg1, "called-function");
                        }
                    } else if (matchImport("untrack", callee.name) && arg0) {
                        // untrack's callback is called synchronously but explicitly NOT
                        // tracked: reads inside are sanctioned, and an async callback is
                        // harmless (there's no subscription to lose), so it must not get
                        // the async-tracked-scope or read-after-await treatment (#188).
                        pushTrackedScope(arg0, "called-function");
                    } else if (matchImport("merge", callee.name)) {
                        // merge wraps function sources in createMemo, so function arguments
                        // are genuinely tracked scopes.
                        for (const arg of node.arguments) {
                            if (arg.type === "SpreadElement") continue;
                            if (isFunctionNode(trace(arg, context))) {
                                pushTrackedScope(arg, "function");
                            }
                        }
                    } else if (
                        matchImport(
                            [
                                "createSignal",
                                "createStore",
                                "createProjection",
                                "createOptimistic",
                                "createOptimisticStore"
                            ],
                            callee.name
                        ) &&
                        isFunctionNode(arg0)
                    ) {
                        // Function-form derived primitives: the function argument is a tracked
                        // scope, and may be async (only reads before the first `await` are
                        // tracked).
                        pushTrackedScope(arg0, "function", true);
                    } else if (matchImport("createReaction", callee.name)) {
                        // `createReaction(effectFn)` takes the untracked effect
                        // and returns the tracking function.
                        pushTrackedScope(arg0, "called-function");
                    } else if (
                        matchImport(
                            ["onCleanup", "onSettled", "onFlush", "action"],
                            callee.name
                        ) ||
                        TIMERS.includes(callee.name)
                    ) {
                        // on* and timers are NOT tracked scopes. However, they
                        // don't need to react to updates to reactive variables; it's okay
                        // to poll the current value. Consider them called-function tracked
                        // scopes for our purposes.
                        pushTrackedScope(arg0, "called-function");
                    } else if (
                        matchImport("createStore", callee.name) &&
                        arg0?.type === "ObjectExpression"
                    ) {
                        for (const property of arg0.properties) {
                            if (
                                property.type === "Property" &&
                                property.kind === "get" &&
                                isFunctionNode(property.value)
                            ) {
                                pushTrackedScope(property.value, "function");
                            }
                        }
                    } else if (matchImport("runWithOwner", callee.name)) {
                        // runWithOwner(owner, fn) only creates a tracked scope if `owner =
                        // getOwner()` runs in a tracked scope. If owner is a variable,
                        // attempt to detect if it's a tracked scope or not, but if this
                        // can't be done, assume it's a tracked scope.
                        if (arg1) {
                            let isTrackedScope = true;
                            const owner =
                                arg0.type === "Identifier" &&
                                findVariable(context, arg0);
                            if (owner) {
                                const decl = owner.defs[0];
                                if (
                                    decl &&
                                    decl.node.type === "VariableDeclarator" &&
                                    decl.node.init?.type === "CallExpression" &&
                                    decl.node.init.callee.type ===
                                        "Identifier" &&
                                    matchImport(
                                        "getOwner",
                                        decl.node.init.callee.name
                                    )
                                ) {
                                    // Check if the function in which getOwner() is called is a tracked scope. If the scopeStack
                                    // has moved on from that scope already, assume it's tracked, since that's less intrusive.
                                    const ownerFunction = findParent(
                                        decl.node,
                                        isProgramOrFunctionNode
                                    );
                                    const scopeStackIndex =
                                        scopeStack.findIndex(
                                            ({ node }) => ownerFunction === node
                                        );
                                    if (
                                        (scopeStackIndex >= 1 &&
                                            !scopeStack[
                                                scopeStackIndex - 1
                                            ].trackedScopes.some(
                                                (trackedScope) =>
                                                    trackedScope.expect ===
                                                        "function" &&
                                                    trackedScope.node ===
                                                        ownerFunction
                                            )) ||
                                        scopeStackIndex === 0
                                    ) {
                                        isTrackedScope = false;
                                    }
                                }
                            }
                            if (isTrackedScope) {
                                pushTrackedScope(arg1, "function");
                            }
                        }
                    } else if (
                        /^(?:use|create)[A-Z]/.test(callee.name) ||
                        matchesCustomReactive(callee.name)
                    ) {
                        // Custom hooks parameters may or may not be tracking scopes, no way to know.
                        // Assume all identifier/function arguments are tracked scopes, and use "called-function"
                        // to allow async handlers (permissive). Assume non-resolvable args are reactive expressions.
                        for (const arg of node.arguments) {
                            permissivelyTrackNode(arg);
                        }
                    } else if (
                        parentScope()?.trackedScopes.some(
                            (trackedScope) =>
                                (trackedScope.expect === "function" ||
                                    trackedScope.expect ===
                                        "called-function") &&
                                trackedScope.node === currentScope().node
                        )
                    ) {
                        // An unknown call inside a tracked scope (e.g. a helper called in an effect
                        // callback). Functions passed to it either run synchronously — still inside the
                        // tracked scope — or run later, where polling current values is fine, like any
                        // called function. Known Solid APIs that intentionally decline to track their
                        // callbacks (like runWithOwner with an untracked owner) match earlier branches.
                        for (const arg of node.arguments) {
                            if (isFunctionNode(arg)) {
                                pushTrackedScope(arg, "called-function");
                            }
                        }
                    }
                } else if (node.callee.type === "MemberExpression") {
                    const { property } = node.callee;
                    if (
                        property.type === "Identifier" &&
                        property.name === "addEventListener" &&
                        node.arguments.length >= 2
                    ) {
                        // Like `on*` event handlers, mark all `addEventListener` listeners as called functions.
                        pushTrackedScope(node.arguments[1], "called-function");
                    } else if (
                        property.type === "Identifier" &&
                        node.callee.object.type === "Identifier" &&
                        ["window", "globalThis", "self"].includes(
                            node.callee.object.name
                        ) &&
                        TIMERS.includes(property.name)
                    ) {
                        // `window.setTimeout` etc. behave exactly like the bare timer globals above:
                        // callbacks are called functions, free to poll current reactive values.
                        if (node.arguments[0]) {
                            pushTrackedScope(
                                node.arguments[0],
                                "called-function"
                            );
                        }
                    } else if (
                        property.type === "Identifier" &&
                        ["then", "catch", "finally"].includes(property.name)
                    ) {
                        // Promise callbacks run after the current tick, like timer callbacks:
                        // they poll current values rather than subscribing, exactly as the same
                        // code would after an `await` (#235).
                        for (const arg of node.arguments) {
                            if (arg.type !== "SpreadElement") {
                                pushTrackedScope(arg, "called-function");
                            }
                        }
                    } else if (
                        property.type === "Identifier" &&
                        (/^(?:use|create)[A-Z]/.test(property.name) ||
                            matchesCustomReactive(property.name))
                    ) {
                        // Handle custom hook parameters for property access custom hooks
                        for (const arg of node.arguments) {
                            permissivelyTrackNode(arg);
                        }
                    }
                }
            } else if (node.type === "VariableDeclarator") {
                // createReaction returns a track function, a tracked scope expecting a
                // reactive function. All of the track function's references where it's
                // called push a tracked scope.
                if (
                    node.init?.type === "CallExpression" &&
                    node.init.callee.type === "Identifier"
                ) {
                    if (
                        matchImport(["createReaction"], node.init.callee.name)
                    ) {
                        const track = getReturnedVar(node.id, context);
                        if (track) {
                            for (const reference of track.references) {
                                if (
                                    !reference.init &&
                                    reference.isReadOnly() &&
                                    reference.identifier.parent?.type ===
                                        "CallExpression" &&
                                    reference.identifier.parent.callee ===
                                        reference.identifier
                                ) {
                                    const arg0 =
                                        reference.identifier.parent
                                            .arguments[0];
                                    if (arg0) {
                                        pushTrackedScope(arg0, "function");
                                    }
                                }
                            }
                        }
                        if (isFunctionNode(node.init.arguments[0])) {
                            pushTrackedScope(
                                node.init.arguments[0],
                                "called-function"
                            );
                        }
                    }
                }
            } else if (node.type === "AssignmentExpression") {
                if (
                    node.left.type === "MemberExpression" &&
                    node.left.property.type === "Identifier" &&
                    isFunctionNode(node.right) &&
                    /^on[a-z]+$/.test(node.left.property.name)
                ) {
                    // To allow (questionable) code like the following example:
                    //     ref.oninput = () = {
                    //       if (!errors[ref.name]) return;
                    //       ...
                    //     }
                    // where event handlers are manually attached to refs, detect these
                    // scenarios and mark the right hand sides as tracked scopes expecting
                    // functions.
                    pushTrackedScope(node.right, "called-function");
                }
            } else if (node.type === "TaggedTemplateExpression") {
                for (const expression of node.quasi.expressions) {
                    if (isFunctionNode(expression)) {
                        // ex. css`color: ${props => props.color}`. Use "called-function" to allow async handlers (permissive)
                        pushTrackedScope(expression, "called-function");
                        // exception case: add a reactive variable within checkForTrackedScopes when a param is props
                        for (const param of expression.params) {
                            if (
                                param.type === "Identifier" &&
                                isPropsByName(param.name)
                            ) {
                                const variable = findVariable(context, param);
                                if (variable)
                                    scopeStack.pushProps(
                                        variable,
                                        currentScope().node
                                    );
                            }
                        }
                    }
                }
            }
        };
        return {
            ImportDeclaration: handleImportDeclaration,
            JSXExpressionContainer(node) {
                checkForTrackedScopes(node);
            },
            JSXSpreadAttribute(node) {
                checkForTrackedScopes(node);
            },
            CallExpression(node) {
                checkForTrackedScopes(node);
                checkForSyncCallbacks(node);
                // ensure calls to reactive primitives use the results. Directly-returned calls
                // (`return createMemo(...)` or as an arrow body) hand their result to the caller,
                // like a custom primitive, so there is nothing to capture in this scope.
                const parent =
                    node.parent && ignoreTransparentWrappers(node.parent, true);
                if (
                    parent?.type !== "AssignmentExpression" &&
                    parent?.type !== "VariableDeclarator" &&
                    parent?.type !== "ReturnStatement" &&
                    !(
                        parent?.type === "ArrowFunctionExpression" &&
                        parent.body === node
                    )
                ) {
                    if (
                        parent?.type === "CallExpression" &&
                        parent.arguments.includes(node)
                    ) {
                        // A primitive call passed to a wrapper, like
                        // `const [state, setState] = makePersisted(createSignal(false))`
                        // (#190). The dominant ecosystem contract passes the tuple through,
                        // so if the outermost wrapper's result is captured, analyze the
                        // primitive as if assigned there directly. If the result isn't
                        // captured, the tuple escaped into the wrapper — nothing can be
                        // concluded, so stay silent rather than warn.
                        let outer = parent;
                        let outerParent =
                            outer.parent &&
                            ignoreTransparentWrappers(outer.parent, true);
                        while (
                            outerParent?.type === "CallExpression" &&
                            outerParent.arguments.includes(outer)
                        ) {
                            outer = outerParent;
                            outerParent =
                                outer.parent &&
                                ignoreTransparentWrappers(outer.parent, true);
                        }
                        if (outerParent?.type === "VariableDeclarator") {
                            checkForReactiveAssignment(outerParent.id, node);
                        } else if (
                            outerParent?.type === "AssignmentExpression" &&
                            outerParent.left.type !== "MemberExpression"
                        ) {
                            checkForReactiveAssignment(outerParent.left, node);
                        }
                    } else {
                        checkForReactiveAssignment(null, node);
                    }
                }
            },
            NewExpression(node) {
                checkForTrackedScopes(node);
            },
            VariableDeclarator(node) {
                if (node.init) {
                    checkForReactiveAssignment(node.id, node.init);
                    checkForTrackedScopes(node);
                }
            },
            AssignmentExpression(node) {
                if (node.left.type !== "MemberExpression") {
                    checkForReactiveAssignment(node.left, node.right);
                }
                checkForTrackedScopes(node);
            },
            TaggedTemplateExpression(node) {
                checkForTrackedScopes(node);
            },
            "JSXElement > JSXExpressionContainer > :function"(node) {
                if (
                    isFunctionNode(node) &&
                    node.parent?.type === "JSXExpressionContainer" &&
                    node.parent.parent?.type === "JSXElement"
                ) {
                    const element = node.parent.parent;
                    if (
                        element.openingElement.name.type === "JSXIdentifier" &&
                        matchImport("For", element.openingElement.name.name)
                    ) {
                        // <For> callback params depend on the `keyed` prop:
                        // - absent, bare `keyed`, or `keyed={true}`: (item, index-accessor)
                        // - `keyed={false}`: (item-accessor, index)
                        // - `keyed={fn}`: (item-accessor, index-accessor)
                        const keyedAttr =
                            element.openingElement.attributes.find(
                                (attr) =>
                                    attr.type === "JSXAttribute" &&
                                    attr.name.type === "JSXIdentifier" &&
                                    attr.name.name === "keyed"
                            );
                        let itemIsSignal = false;
                        let indexIsSignal = true;
                        if (
                            keyedAttr &&
                            keyedAttr.value?.type === "JSXExpressionContainer"
                        ) {
                            const keyedValue = keyedAttr.value.expression;
                            if (
                                keyedValue.type === "Literal" &&
                                keyedValue.value === false
                            ) {
                                itemIsSignal = true;
                                indexIsSignal = false;
                            } else if (
                                !(
                                    keyedValue.type === "Literal" &&
                                    keyedValue.value === true
                                )
                            ) {
                                // key function: both params are accessors
                                itemIsSignal = true;
                            }
                        }
                        if (
                            itemIsSignal &&
                            node.params.length >= 1 &&
                            node.params[0].type === "Identifier"
                        ) {
                            const item = findVariable(context, node.params[0]);
                            if (item) {
                                scopeStack.pushSignal(
                                    item,
                                    currentScope().node
                                );
                            }
                        }
                        if (
                            indexIsSignal &&
                            node.params.length === 2 &&
                            node.params[1].type === "Identifier"
                        ) {
                            // Mark `index` in `<For>{(item, index) => <div /></For>` as a signal
                            const index = findVariable(context, node.params[1]);
                            if (index) {
                                scopeStack.pushSignal(
                                    index,
                                    currentScope().node
                                );
                            }
                        }
                    }
                }
            },
            /* Function enter/exit */
            FunctionExpression: onFunctionEnter,
            ArrowFunctionExpression: onFunctionEnter,
            FunctionDeclaration: onFunctionEnter,
            Program: onFunctionEnter,
            "FunctionExpression:exit": onFunctionExit,
            "ArrowFunctionExpression:exit": onFunctionExit,
            "FunctionDeclaration:exit": onFunctionExit,
            "Program:exit": onFunctionExit,
            /* Detect JSX for adding props */
            JSXElement() {
                if (scopeStack.length) {
                    currentScope().hasJSX = true;
                }
            },
            JSXFragment() {
                if (scopeStack.length) {
                    currentScope().hasJSX = true;
                }
            }
        };
    }
};
