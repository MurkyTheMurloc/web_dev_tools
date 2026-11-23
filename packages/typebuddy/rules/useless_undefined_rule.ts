// A fork of unicorn's `no-useless-undefined` (MIT, sindresorhus/eslint-plugin-
// unicorn), with the behaviour and options of oxlint's port of it
// (`oxc_linter/src/rules/unicorn/no_useless_undefined.rs`, oxlint 1.94), and
// one change: `let x: Optional<T> = undefined` is not reported. typebuddy wants
// every `let` initialised (`eslint/init-declarations`), and `undefined` is the
// honest start value of an `Optional<T>`, as `null` is of a `Maybe<T>`.
//
// Where oxlint and this fork differ, it is on purpose:
// - an un-annotated `let x = undefined` is reported without an autofix: the
//   fix is a type or a real default, not `let x;`;
// - trailing `undefined` arguments are reported without an autofix (oxlint's
//   is a dangerous fix that `--fix` does not apply either).

type Range = [number, number];

type Node = {
    readonly type: string;
    readonly range: Range;
    readonly parent: Node;
    readonly alternate?: Node;
    readonly argument?: Node;
    readonly arguments?: readonly Node[];
    readonly bigint?: string;
    readonly body?: Node;
    readonly callee?: Node;
    readonly computed?: boolean;
    readonly consequent?: Node;
    readonly delegate?: boolean;
    readonly expression?: Node;
    readonly expressions?: readonly Node[];
    readonly id?: Node;
    readonly init?: Node | null;
    readonly kind?: string;
    readonly left?: Node;
    readonly name?: string;
    readonly object?: Node;
    readonly operator?: string;
    readonly optional?: boolean;
    readonly parameter?: Node;
    readonly params?: readonly Node[];
    readonly property?: Node;
    readonly quasis?: readonly Node[];
    readonly raw?: string;
    readonly regex?: { pattern: string; flags: string };
    readonly returnType?: Node | null;
    readonly right?: Node;
    readonly tag?: Node;
    readonly test?: Node;
    readonly typeAnnotation?: Node | null;
    readonly typeName?: Node;
    readonly types?: readonly Node[];
    readonly value?: unknown;
};

type Token = { readonly value: string; readonly range: Range };

type RuleFixer = {
    removeRange(range: Range): unknown;
    replaceTextRange(range: Range, text: string): unknown;
    insertTextAfterRange(range: Range, text: string): unknown;
};

type Fix = (fixer: RuleFixer) => unknown;

type Scope = {
    readonly upper: Scope | null;
    readonly references: readonly {
        readonly identifier: unknown;
        readonly resolved: { readonly defs: readonly unknown[] } | null;
    }[];
};

type Options = {
    checkArguments?: boolean;
    checkArrowFunctionBody?: boolean;
};

type RuleContext = {
    readonly filename: string;
    readonly options: readonly (Options | undefined)[];
    readonly sourceCode: {
        readonly text: string;
        getText(node: Node): string;
        getAllComments(): readonly { range: Range }[];
        getTokenBefore(node: { range: Range }): Token | null;
        getTokenAfter(node: { range: Range }): Token | null;
        getLastToken(node: Node): Token | null;
        getScope(node: Node): Scope;
    };
    report(descriptor: {
        node: Node;
        messageId: string;
        data?: Record<string, string>;
        fix?: Fix;
        suggest?: {
            messageId: string;
            data?: Record<string, string>;
            fix: Fix;
        }[];
    }): void;
};

const FUNCTION_TYPES = new Set([
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression"
]);

// Calls whose trailing `undefined` means something: assertions comparing with
// `undefined`, collection methods storing it, `createContext`/`useRef`/`ref`
// starting with it. oxlint's list; names starting with `set` count too.
const IGNORED_CALLEES = new Set([
    "add",
    "createContext",
    "equal",
    "has",
    "include",
    "includes",
    "is",
    "not",
    "notEqual",
    "notPropertyVal",
    "notSame",
    "notStrictEqual",
    "property",
    "propertyVal",
    "push",
    "ref",
    "same",
    "set",
    "strictEqual",
    "strictNotSame",
    "strictSame",
    "toBe",
    "toContain",
    "toContainEqual",
    "toEqual",
    "toHaveBeenCalledWith",
    "unshift",
    "useRef"
]);

const TS_WRAPPERS = new Set([
    "TSAsExpression",
    "TSInstantiationExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion"
]);

const RELATIONAL = new Set(["<", "<=", ">", ">="]);
const FLIPPED: Record<string, string> = {
    "<": ">",
    "<=": ">=",
    ">": "<",
    ">=": "<="
};

// Expressions that may run code or read something that changes, so dropping
// the bounds check in front of them could change behaviour.
const UNSAFE_IN_ACCESS = new Set([
    "AssignmentExpression",
    "AwaitExpression",
    "CallExpression",
    "ChainExpression",
    "ClassExpression",
    "ImportExpression",
    "JSXElement",
    "JSXFragment",
    "MemberExpression",
    "NewExpression",
    "SpreadElement",
    "TaggedTemplateExpression",
    "UpdateExpression",
    "YieldExpression"
]);

// Parents through which the conditional can still start its statement.
const STATEMENT_START_PARENTS = new Set([
    "AssignmentExpression",
    "AwaitExpression",
    "BinaryExpression",
    "CallExpression",
    "ChainExpression",
    "ConditionalExpression",
    "LogicalExpression",
    "MemberExpression",
    "SequenceExpression",
    "TaggedTemplateExpression",
    ...TS_WRAPPERS
]);

const UNBRACED_BODY_PARENTS = new Set([
    "DoWhileStatement",
    "ForInStatement",
    "ForOfStatement",
    "ForStatement",
    "IfStatement",
    "LabeledStatement",
    "WhileStatement",
    "WithStatement"
]);

function isNode(value: unknown): value is Node {
    return typeof value === "object" && value !== null && "type" in value;
}

function children(node: Node): Node[] {
    const result: Node[] = [];
    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") continue;
        if (Array.isArray(value)) {
            result.push(...value.filter(isNode));
        } else if (isNode(value)) {
            result.push(value);
        }
    }
    return result;
}

function containsChain(node: Node): boolean {
    return (
        node.type === "ChainExpression" || children(node).some(containsChain)
    );
}

function isSafeAccessPart(node: Node): boolean {
    if (UNSAFE_IN_ACCESS.has(node.type)) return false;
    if (node.type === "UnaryExpression" && node.operator === "delete") {
        return false;
    }
    if (
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
    ) {
        return !containsChain(node);
    }
    return children(node).every(isSafeAccessPart);
}

function inner(node: Node): Node {
    let current = node;
    while (TS_WRAPPERS.has(current.type) && current.expression) {
        current = current.expression;
    }
    return current;
}

function staticNumber(node: Node): number | undefined {
    const current = inner(node);
    if (current.type === "Literal" && typeof current.value === "number") {
        return current.value;
    }
    if (current.type === "UnaryExpression" && current.argument) {
        const value = staticNumber(current.argument);
        if (value === undefined) return undefined;
        if (current.operator === "+") return value;
        if (current.operator === "-") return -value;
    }
    return undefined;
}

function isNumberLiteral(node: Node): boolean {
    return node.type === "Literal" && typeof node.value === "number";
}

function isBigIntLiteral(node: Node): boolean {
    return node.type === "Literal" && typeof node.bigint === "string";
}

function singleQuasi(node: Node): string | undefined {
    if (node.expressions?.length !== 0 || node.quasis?.length !== 1) {
        return undefined;
    }
    const [quasi] = node.quasis;
    const value = quasi?.value;
    if (typeof value === "object" && value !== null && "cooked" in value) {
        return String(value.cooked);
    }
    return undefined;
}

function isSameSimpleExpression(left: Node, right: Node): boolean {
    if (left.type === "Identifier" && right.type === "Identifier") {
        return left.name === right.name;
    }
    if (left.type === "ThisExpression" || left.type === "Super") {
        return left.type === right.type;
    }
    if (left.type === "TemplateLiteral" || right.type === "TemplateLiteral") {
        const leftText =
            left.type === "TemplateLiteral" ? singleQuasi(left) : left.value;
        const rightText =
            right.type === "TemplateLiteral" ? singleQuasi(right) : right.value;
        return typeof leftText === "string" && leftText === rightText;
    }
    if (left.type !== "Literal" || right.type !== "Literal") return false;
    if (left.regex || right.regex) {
        return (
            left.regex?.pattern === right.regex?.pattern &&
            left.regex?.flags === right.regex?.flags
        );
    }
    if (isNumberLiteral(left) || isNumberLiteral(right)) {
        return left.raw === right.raw;
    }
    return left.value === right.value;
}

function isSameIndexReference(leftNode: Node, rightNode: Node): boolean {
    const left = inner(leftNode);
    const right = inner(rightNode);
    if (isNumberLiteral(left) && isNumberLiteral(right)) {
        return left.value === right.value;
    }
    if (isBigIntLiteral(left) && isBigIntLiteral(right)) {
        return BigInt(left.bigint ?? "") === BigInt(right.bigint ?? "");
    }
    const simple =
        left.type === "Literal" ||
        left.type === "Identifier" ||
        left.type === "ThisExpression" ||
        left.type === "Super" ||
        (left.type === "TemplateLiteral" && left.expressions?.length === 0);
    return simple && isSameSimpleExpression(left, right);
}

/**
 * Whether `test` makes `access` an in-bounds read (`true`) or an out-of-bounds
 * one (`false`) when it passes; `undefined` when it says nothing about that.
 */
function boundsTestValidity(testNode: Node, access: Node): boolean | undefined {
    const test = inner(testNode);
    if (
        test.type !== "BinaryExpression" ||
        !test.left ||
        !test.right ||
        !test.operator ||
        !RELATIONAL.has(test.operator) ||
        !access.property ||
        !access.object
    ) {
        return undefined;
    }

    let index = inner(access.property);
    let offset = 0;
    if (
        index.type === "BinaryExpression" &&
        index.operator === "-" &&
        index.left &&
        index.right
    ) {
        const subtracted = staticNumber(index.right);
        if (
            subtracted !== undefined &&
            Number.isSafeInteger(subtracted) &&
            subtracted > 0
        ) {
            index = inner(index.left);
            offset = subtracted;
        }
    }

    let operator = test.operator;
    let boundary: Node;
    if (isSameIndexReference(test.left, index)) {
        boundary = inner(test.right);
    } else if (isSameIndexReference(test.right, index)) {
        operator = FLIPPED[operator] ?? operator;
        boundary = inner(test.left);
    } else {
        return undefined;
    }

    const bound = staticNumber(boundary);
    if (bound !== undefined && Number.isSafeInteger(bound)) {
        if (operator === ">=" && bound === offset) return true;
        if (operator === ">" && bound === offset - 1) return true;
        if (operator === "<" && bound === offset) return false;
        if (operator === "<=" && bound === offset - 1) return false;
        return undefined;
    }
    if (offset !== 0) return undefined;

    let length = boundary;
    let minusOne = false;
    if (
        boundary.type === "BinaryExpression" &&
        boundary.operator === "-" &&
        boundary.left &&
        boundary.right &&
        staticNumber(boundary.right) === 1
    ) {
        length = inner(boundary.left);
        minusOne = true;
    }
    if (
        length.type !== "MemberExpression" ||
        length.computed === true ||
        length.optional === true ||
        length.property?.name !== "length" ||
        !length.object ||
        !isSameIndexReference(length.object, access.object)
    ) {
        return undefined;
    }

    if ((operator === "<" && !minusOne) || (operator === "<=" && minusOne)) {
        return true;
    }
    if ((operator === ">=" && !minusOne) || (operator === ">" && minusOne)) {
        return false;
    }
    return undefined;
}

/** `Optional<…>`, or a union with `undefined` (or an `Optional`) in it. */
function admitsUndefined(type: Node | null | undefined): boolean {
    if (!type) return false;
    if (type.type === "TSTypeReference") {
        return (
            type.typeName?.type === "Identifier" &&
            type.typeName.name === "Optional"
        );
    }
    if (type.type === "TSUnionType") {
        return (type.types ?? []).some(
            (member) =>
                member.type === "TSUndefinedKeyword" || admitsUndefined(member)
        );
    }
    return false;
}

function hasNonVoidReturnType(node: Node): boolean {
    let current: Node | undefined = node.parent;
    while (current && current.type !== "Program") {
        if (FUNCTION_TYPES.has(current.type)) {
            const type = current.returnType?.typeAnnotation?.type;
            return (
                type !== undefined &&
                type !== "TSVoidKeyword" &&
                type !== "TSUndefinedKeyword"
            );
        }
        current = current.parent;
    }
    return false;
}

/** A default inside a destructuring assignment target, not a binding. */
function isInAssignmentTarget(pattern: Node): boolean {
    let current = pattern;
    for (;;) {
        const { parent } = current;
        if (
            parent.type === "ArrayPattern" ||
            parent.type === "ObjectPattern" ||
            parent.type === "RestElement" ||
            (parent.type === "AssignmentPattern" && parent.left === current) ||
            (parent.type === "Property" &&
                parent.parent.type === "ObjectPattern")
        ) {
            current = parent;
            continue;
        }
        return (
            (parent.type === "AssignmentExpression" ||
                parent.type === "ForInStatement" ||
                parent.type === "ForOfStatement") &&
            parent.left === current
        );
    }
}

function isOptionalParameter(parameter: Node): boolean {
    const target =
        parameter.type === "TSParameterProperty" && parameter.parameter
            ? parameter.parameter
            : parameter;
    return target.optional === true;
}

function hasDefault(parameter: Node): boolean {
    const target =
        parameter.type === "TSParameterProperty" && parameter.parameter
            ? parameter.parameter
            : parameter;
    return target.type === "AssignmentPattern";
}

const IDENTIFIER_START = /[\p{ID_Start}$_]/u;
const IDENTIFIER_PART = /[\p{ID_Continue}$‌‍]/u;

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.text;
        const options = context.options[0] ?? {};
        const checkArguments = options.checkArguments ?? true;
        const checkArrowFunctionBody = options.checkArrowFunctionBody ?? true;
        const isTypeScript = /\.[cm]?tsx?$/u.test(context.filename);

        // The global `undefined`: a reference nothing in the file declares.
        // (`isGlobalReference` also needs `undefined` among the configured
        // globals, which a bare config does not have.)
        function isGlobalUndefined(node: Node | undefined): node is Node {
            if (node?.type !== "Identifier" || node.name !== "undefined") {
                return false;
            }
            for (
                let scope: Scope | null = sourceCode.getScope(node);
                scope;
                scope = scope.upper
            ) {
                const reference = scope.references.find(
                    (ref) => ref.identifier === node
                );
                if (reference) {
                    return (
                        reference.resolved === null ||
                        reference.resolved.defs.length === 0
                    );
                }
            }
            return false;
        }

        function hasComments([start, end]: Range): boolean {
            return sourceCode
                .getAllComments()
                .some(
                    (comment) =>
                        comment.range[0] >= start && comment.range[0] < end
                );
        }

        /** `node`'s range including the parentheses around it. */
        function parenthesized(node: Node): Range {
            let range: Range = node.range;
            for (;;) {
                const before = sourceCode.getTokenBefore({ range });
                const after = sourceCode.getTokenAfter({ range });
                if (before?.value !== "(" || after?.value !== ")") return range;
                range = [before.range[0], after.range[1]];
            }
        }

        function removeAfter(start: number, end: number): Fix {
            return (fixer) =>
                hasComments([start, end])
                    ? null
                    : fixer.removeRange([start, end]);
        }

        function couldBeAsiHazard(node: Node): boolean {
            let statement: Node | undefined;
            for (let current = node.parent; ; current = current.parent) {
                if (current.type === "ExpressionStatement") {
                    if (UNBRACED_BODY_PARENTS.has(current.parent.type))
                        return false;
                    statement = current;
                    break;
                }
                if (!STATEMENT_START_PARENTS.has(current.type)) return false;
            }
            if (
                node.range[0] !== statement.range[0] ||
                statement.range[0] === 0
            ) {
                return false;
            }
            const last = sourceCode.getTokenBefore(statement)?.value.at(-1);
            return (
                last !== undefined && /[\p{L}\p{N}_$)\]}"'`+\-/.]/u.test(last)
            );
        }

        function isReferenceContext(node: Node): boolean {
            let expression = node;
            for (let parent = node.parent; ; parent = parent.parent) {
                if (TS_WRAPPERS.has(parent.type)) {
                    expression = parent;
                    continue;
                }
                if (parent.type === "CallExpression")
                    return parent.callee === expression;
                if (parent.type === "TaggedTemplateExpression")
                    return parent.tag === expression;
                return (
                    parent.type === "UnaryExpression" &&
                    parent.operator === "delete"
                );
            }
        }

        function reportParameter(
            node: Node,
            pattern: Node,
            item: Node,
            fn: Node
        ): void {
            const params = fn.params ?? [];
            const position = params.indexOf(item);
            if (params.slice(0, position).some(isOptionalParameter)) return;

            const left = pattern.left;
            if (!left) return;
            const annotation = left.typeAnnotation;
            const canBeOptional = params
                .slice(position + 1)
                .filter((parameter) => parameter.type !== "RestElement")
                .every(
                    (parameter) =>
                        isOptionalParameter(parameter) || hasDefault(parameter)
                );
            const isIdentifier = left.type === "Identifier";
            const name = isIdentifier
                ? (left.name ?? "")
                : sourceCode.getText(left);
            const typeText = annotation?.typeAnnotation
                ? sourceCode.getText(annotation.typeAnnotation)
                : undefined;
            const suggested =
                isTypeScript && isIdentifier && !left.optional
                    ? canBeOptional
                        ? `${name}?: ${typeText ?? "T"}`
                        : `${name}: ${typeText ?? "Optional<T>"}`
                    : sourceCode.getText(left);
            const descriptor = {
                node,
                messageId: "parameterUndefined",
                data: { name, fix: suggested }
            };

            if (
                isTypeScript &&
                (!isIdentifier || !annotation || item !== pattern)
            ) {
                context.report(descriptor);
                return;
            }

            const start = left.range[1];
            const end = parenthesized(node)[1];
            context.report({
                ...descriptor,
                fix(fixer) {
                    if (hasComments([start, end])) return null;
                    const removal = fixer.removeRange([start, end]);
                    if (
                        !isTypeScript ||
                        left.optional ||
                        !canBeOptional ||
                        !annotation
                    ) {
                        return removal;
                    }
                    const nameEnd =
                        sourceCode.getTokenBefore(annotation)?.range[1];
                    if (nameEnd === undefined) return removal;
                    return [
                        removal,
                        fixer.insertTextAfterRange([nameEnd, nameEnd], "?")
                    ];
                }
            });
        }

        function onUndefined(node: Node): void {
            const { parent } = node;
            const outer = parenthesized(node);

            switch (parent.type) {
                case "ReturnStatement": {
                    if (hasNonVoidReturnType(parent)) return;
                    const before = sourceCode
                        .getAllComments()
                        .filter(
                            (comment) =>
                                comment.range[0] >= parent.range[0] &&
                                comment.range[0] < outer[0]
                        )
                        .at(-1);
                    const start = before
                        ? before.range[1]
                        : parent.range[0] + "return".length;
                    context.report({
                        node,
                        messageId: "returnUndefined",
                        fix: removeAfter(start, outer[1])
                    });
                    return;
                }
                case "YieldExpression": {
                    if (parent.delegate === true) return;
                    context.report({
                        node,
                        messageId: "yieldUndefined",
                        fix: (fixer) =>
                            hasComments(parent.range)
                                ? null
                                : fixer.replaceTextRange(parent.range, "yield")
                    });
                    return;
                }
                case "ArrowFunctionExpression": {
                    if (
                        parent.body !== node ||
                        !checkArrowFunctionBody ||
                        parent.returnType
                    ) {
                        return;
                    }
                    context.report({
                        node,
                        messageId: "arrowUndefined",
                        fix: (fixer) =>
                            hasComments(outer)
                                ? null
                                : fixer.replaceTextRange(outer, "{}")
                    });
                    return;
                }
                case "VariableDeclarator": {
                    const id = parent.id;
                    if (
                        parent.init !== node ||
                        parent.parent.kind !== "let" ||
                        id?.type !== "Identifier" ||
                        // typebuddy: `undefined` is the start value of an
                        // `Optional<T>`; `eslint/init-declarations` wants it.
                        admitsUndefined(id.typeAnnotation?.typeAnnotation)
                    ) {
                        return;
                    }
                    context.report({
                        node,
                        messageId: "letUndefined",
                        data: {
                            declarator: sourceCode.getText(parent),
                            name: id.name ?? ""
                        }
                    });
                    return;
                }
                case "AssignmentPattern": {
                    if (parent.right !== node) return;
                    const owner = parent.parent;
                    if (FUNCTION_TYPES.has(owner.type)) {
                        reportParameter(node, parent, parent, owner);
                        return;
                    }
                    if (owner.type === "TSParameterProperty") {
                        reportParameter(node, parent, owner, owner.parent);
                        return;
                    }
                    if (isInAssignmentTarget(parent) || !parent.left) return;
                    const descriptor = {
                        node,
                        messageId: "defaultUndefined",
                        data: { name: sourceCode.getText(parent.left) }
                    };
                    context.report(
                        isTypeScript
                            ? descriptor
                            : {
                                  ...descriptor,
                                  fix: removeAfter(
                                      parent.left.range[1],
                                      outer[1]
                                  )
                              }
                    );
                    return;
                }
                default:
            }
        }

        function onCall(node: Node): void {
            const args = node.arguments ?? [];
            const callee = node.callee;
            if (!callee || !isTrailingUndefined(node, args.at(-1))) return;

            const calleeName =
                callee.type === "Identifier"
                    ? callee.name
                    : callee.type === "MemberExpression" &&
                        callee.computed !== true &&
                        callee.property?.type === "Identifier"
                      ? callee.property.name
                      : undefined;
            if (
                calleeName !== undefined &&
                (IGNORED_CALLEES.has(calleeName) ||
                    calleeName.startsWith("set"))
            ) {
                return;
            }
            // `fn.bind(thisArg, undefined)` binds an argument; only a lone
            // `undefined` `this` is useless.
            if (
                node.optional !== true &&
                callee.type === "MemberExpression" &&
                staticPropertyName(callee) === "bind" &&
                args.length !== 1
            ) {
                return;
            }

            let first = args.length - 1;
            while (first > 0 && isTrailingUndefined(node, args[first - 1]))
                first -= 1;
            const firstUndefined = args[first];
            if (!firstUndefined) return;

            context.report({
                node: firstUndefined,
                messageId: "argumentUndefined",
                data: { callee: sourceCode.getText(callee) }
            });
        }

        function isTrailingUndefined(
            call: Node,
            argument: Node | undefined
        ): boolean {
            if (!isGlobalUndefined(argument)) return false;
            // `foo((undefined))` is left alone, as oxlint does.
            const after = sourceCode.getTokenAfter(argument);
            const last = sourceCode.getLastToken(call);
            return !(after?.value === ")" && after.range[0] !== last?.range[0]);
        }

        function staticPropertyName(member: Node): string | undefined {
            const property = member.property;
            if (!property) return undefined;
            if (member.computed !== true) return property.name;
            if (
                property.type === "Literal" &&
                typeof property.value === "string"
            ) {
                return property.value;
            }
            if (property.type === "TemplateLiteral")
                return singleQuasi(property);
            return undefined;
        }

        function onConditional(node: Node): void {
            const { consequent, alternate, test } = node;
            if (!consequent || !alternate || !test) return;
            const consequentUndefined = isGlobalUndefined(consequent);
            if (consequentUndefined === isGlobalUndefined(alternate)) return;

            const [undefinedNode, branch] = consequentUndefined
                ? [consequent, alternate]
                : [alternate, consequent];
            const access = inner(branch);
            if (
                access.type !== "MemberExpression" ||
                access.computed !== true ||
                access.optional === true ||
                !access.object ||
                !access.property ||
                boundsTestValidity(test, access) !== !consequentUndefined ||
                !isSafeAccessPart(access.object) ||
                !isSafeAccessPart(access.property)
            ) {
                return;
            }

            const branchRange = parenthesized(branch);
            const accessText = text.slice(branchRange[0], branchRange[1]);
            const descriptor = {
                node: undefinedNode,
                messageId: "guardedIndexedAccess",
                data: { access: accessText }
            };
            if (hasComments(node.range) || isReferenceContext(node)) {
                context.report(descriptor);
                return;
            }

            let replacement = accessText;
            const objectType = inner(access.object).type;
            if (
                (replacement.startsWith("<") ||
                    objectType === "ObjectExpression" ||
                    objectType === "FunctionExpression") &&
                !replacement.startsWith("(")
            ) {
                replacement = `(${replacement})`;
            }
            if (/^[[(/+\-`]/u.test(replacement) && couldBeAsiHazard(node)) {
                replacement = `;${replacement}`;
            }
            const [start, end] = node.range;
            if (
                start > 0 &&
                IDENTIFIER_PART.test(text[start - 1] ?? "") &&
                IDENTIFIER_PART.test(replacement[0] ?? "")
            ) {
                replacement = ` ${replacement}`;
            }
            if (
                end < text.length &&
                IDENTIFIER_START.test(text[end] ?? "") &&
                !/\s$/u.test(replacement)
            ) {
                replacement = `${replacement} `;
            }

            context.report({
                ...descriptor,
                suggest: [
                    {
                        messageId: "useIndexedAccess",
                        data: { access: accessText },
                        fix: (fixer) =>
                            fixer.replaceTextRange(node.range, replacement)
                    }
                ]
            });
        }

        return {
            Identifier(node: Node) {
                if (isGlobalUndefined(node)) onUndefined(node);
            },
            CallExpression(node: Node) {
                if (checkArguments) onCall(node);
            },
            ConditionalExpression: onConditional
        };
    },
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Disallow useless `undefined`, except as the start value of an `Optional<T>` `let`"
        },
        fixable: "code",
        hasSuggestions: true,
        defaultOptions: [
            { checkArguments: true, checkArrowFunctionBody: true }
        ],
        schema: [
            {
                type: "object",
                additionalProperties: false,
                properties: {
                    checkArguments: { type: "boolean" },
                    checkArrowFunctionBody: { type: "boolean" }
                }
            }
        ],
        messages: {
            letUndefined:
                "`let {{declarator}}` starts `{{name}}` at `undefined`, but no `Optional<…>` type says `{{name}}` may hold it; without an annotation TypeScript types `{{name}}` from later assignments. Fix: annotate it, `let {{name}}: Optional<T> = undefined;` (`undefined` is the start value of an `Optional<T>`; a `Maybe<T>` starts at `null`: `let {{name}}: Maybe<T> = null;`), or give `{{name}}` its real default. Do not: drop the initializer (`let {{name}};`), `eslint/init-declarations` reports a `let` without one.",
            returnUndefined:
                "`return undefined` spells out what a bare `return` already returns. Fix: `return;`, or annotate the function's return type as `Optional<T>` when `undefined` is one of its results (then the rule keeps the `undefined`).",
            yieldUndefined:
                "`yield undefined` spells out what a bare `yield` already yields. Fix: `yield;`.",
            arrowUndefined:
                "The arrow body `undefined` spells out what an empty body already returns. Fix: `=> {}`, or annotate the return type (`(): Optional<T> => undefined`) when `undefined` is the arrow's result.",
            argumentUndefined:
                "The trailing `undefined` passed to `{{callee}}` is what an omitted argument already is. Fix: drop the trailing `undefined` arguments from the `{{callee}}(…)` call, unless `{{callee}}` reads `arguments.length` or a rest parameter (then keep them and disable the line).",
            defaultUndefined:
                "The default `{{name}} = undefined` spells out what a missing property or element already is. Fix: `{{name}}`.",
            parameterUndefined:
                "The default `= undefined` on `{{name}}` spells out what an omitted argument already is. Fix: `{{fix}}`.",
            guardedIndexedAccess:
                "`{{access}}` is already `undefined` out of bounds, so this bounds check and its `undefined` branch repeat it. Fix: `{{access}}` on its own (the editor suggestion applies it).",
            useIndexedAccess: "Use `{{access}}` directly."
        }
    }
};

export { rule as uselessUndefinedRule };
