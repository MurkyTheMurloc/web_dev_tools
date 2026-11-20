type AstNode = {
    type: string;
    parent?: AstNode;
    [key: string]: unknown;
};

const PACKAGE_NAME = "@murky-web/typebuddy";

/**
 * The entries that export `ok` and `err`. The result helpers live in their own
 * entry so a caller that only needs them does not pull the guards along, and a
 * file that imports them from there already has what the fix is about to add.
 */
const RESULT_HELPER_SOURCES = new Set([PACKAGE_NAME, `${PACKAGE_NAME}/result`]);
const TYPE_SOURCES = new Set([PACKAGE_NAME]);

type ImportKind = "type" | "value";

/** What a rule needs from `context.getSourceCode()` to plan an import. */
type ImportSourceCode = {
    getScope(node: unknown): unknown;
};

/**
 * The outcome of looking for a name before a fix uses it:
 *
 * - `present`: the file already imports it from the package, nothing to add.
 * - `global`: no import can be added here (a script file), so a type is written
 *   by its global name, as before.
 * - `conflict`: the name is something else at that spot (a catch parameter, a
 *   local, another library's import), or it is a value in a place that cannot
 *   import. Using it would call or type the wrong thing, so the fix must not be
 *   offered.
 * - `insert`: nothing of that name is in scope; add this edit. It is a new import
 *   line, or the name appended to an import of the package that is already
 *   there.
 */
type ImportPlan =
    | { readonly kind: "present" }
    | { readonly kind: "global" }
    | { readonly kind: "conflict" }
    | {
          readonly kind: "insert";
          readonly range: [number, number];
          readonly text: string;
      };

function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function isImportDeclaration(node: unknown): node is AstNode {
    return isNode(node) && node.type === "ImportDeclaration";
}

function getStringLiteralValue(node: unknown): string | null {
    if (!isNode(node)) {
        return null;
    }

    if (
        (node.type === "Literal" || node.type === "StringLiteral") &&
        typeof node["value"] === "string"
    ) {
        return node["value"];
    }

    return null;
}

function getModuleExportName(node: unknown): string | null {
    if (!isNode(node)) {
        return null;
    }

    if (node.type === "Identifier" && typeof node["name"] === "string") {
        return node["name"];
    }

    return getStringLiteralValue(node);
}

function getProgram(node: unknown): AstNode | null {
    if (!isNode(node)) {
        return null;
    }

    let current: AstNode | undefined = node;
    while (current?.parent) {
        current = current.parent;
    }

    return current?.type === "Program" ? current : null;
}

function getProgramBody(program: AstNode): AstNode[] {
    if (!Array.isArray(program["body"])) {
        return [];
    }

    return program["body"].filter(isNode);
}

/** `"use client"`, `"use cache"`, `"use strict"`: the directive prologue. */
function isDirective(statement: AstNode): boolean {
    return (
        statement.type === "ExpressionStatement" &&
        typeof statement["directive"] === "string"
    );
}

const MODULE_STATEMENTS = new Set([
    "ExportAllDeclaration",
    "ExportDefaultDeclaration",
    "ExportNamedDeclaration",
    "ImportDeclaration",
    "TSExportAssignment"
]);

function isModuleStatement(statement: AstNode): boolean {
    if (MODULE_STATEMENTS.has(statement.type)) {
        return true;
    }

    // `import fs = require("fs")` makes a file a module, `import a = b.c` is
    // only an alias.
    if (statement.type !== "TSImportEqualsDeclaration") {
        return false;
    }
    const reference = statement["moduleReference"];
    return isNode(reference) && reference.type === "TSExternalModuleReference";
}

/**
 * Whether the file is a module. TypeScript decides this by its statements, not
 * by the extension: a file without an `import` or `export` is a script, its
 * top-level names are global, and adding an `import` would turn it into a
 * module and take its globals away (`vite-env.d.ts` with `interface
 * ImportMetaEnv`, `interface Window`, `declare var`).
 */
function isModule(program: AstNode): boolean {
    return getProgramBody(program).some(isModuleStatement);
}

/**
 * Whether the file the node is in can take an import without changing what it
 * is: it already is a module. A script file cannot, and `ok`/`err` have no
 * global name to fall back on, so a rule that needs them there must not offer a
 * fix.
 *
 * @param {unknown} node - Any node of the file.
 * @returns {boolean} True when an import can be added to the file.
 */
function canAddImport(node: unknown): boolean {
    const program = getProgram(node);
    return program !== null && isModule(program);
}

type ScopeLike = {
    upper: ScopeLike | null;
    set: Map<string, unknown>;
};

function isScopeLike(value: unknown): value is ScopeLike {
    return (
        typeof value === "object" &&
        value !== null &&
        "set" in value &&
        value.set instanceof Map
    );
}

function getUpperScope(scope: ScopeLike): ScopeLike | null {
    const upper: unknown = scope.upper;
    return isScopeLike(upper) ? upper : null;
}

/** The first binding of `name` visible from `node`, innermost scope first. */
function findBinding(
    sourceCode: ImportSourceCode,
    node: unknown,
    name: string
): unknown {
    const start: unknown = sourceCode.getScope(node);
    let scope: ScopeLike | null = isScopeLike(start) ? start : null;

    while (scope) {
        const variable = scope.set.get(name);
        if (variable !== undefined) {
            return variable;
        }
        scope = getUpperScope(scope);
    }

    return undefined;
}

function getDefinitions(variable: unknown): unknown[] {
    if (
        typeof variable === "object" &&
        variable !== null &&
        "defs" in variable &&
        Array.isArray(variable.defs)
    ) {
        return variable.defs;
    }

    return [];
}

function sourcesFor(kind: ImportKind): ReadonlySet<string> {
    return kind === "value" ? RESULT_HELPER_SOURCES : TYPE_SOURCES;
}

/**
 * Whether one definition is `import { name } from "<package>"`, imported under
 * its own name. A renamed import (`import { ok as okay }`), a default import
 * and an import from another module are different bindings that happen to share
 * the name. For a value, a type-only import does not count either: it has no
 * runtime binding to call.
 */
function isPackageImport(
    definition: unknown,
    name: string,
    kind: ImportKind
): boolean {
    if (
        typeof definition !== "object" ||
        definition === null ||
        !("type" in definition) ||
        definition.type !== "ImportBinding" ||
        !("node" in definition) ||
        !("parent" in definition)
    ) {
        return false;
    }

    const specifier = definition.node;
    const declaration = definition.parent;
    if (
        !isNode(specifier) ||
        specifier.type !== "ImportSpecifier" ||
        !isImportDeclaration(declaration)
    ) {
        return false;
    }

    const source = getStringLiteralValue(declaration["source"]);
    if (source === null || !sourcesFor(kind).has(source)) {
        return false;
    }
    if (getModuleExportName(specifier["imported"]) !== name) {
        return false;
    }
    if (kind === "value") {
        return (
            declaration["importKind"] !== "type" &&
            specifier["importKind"] !== "type"
        );
    }

    return true;
}

function getSpecifiers(declaration: AstNode): AstNode[] {
    return Array.isArray(declaration["specifiers"])
        ? declaration["specifiers"].filter(isNode)
        : [];
}

type MergeTarget = {
    /** Where the new specifier goes: right after the last named one. */
    readonly at: number;
    /**
     * The specifier needs its own `type` modifier (a type joining a value
     * import).
     */
    readonly inlineType: boolean;
};

/**
 * The import of the package that the name can join, or `null` when there is
 * none. A value joins `import { … }`. A type joins `import type { … }`, or else
 * an `import { … }` of the package as `type Name` (an inline type specifier),
 * so the file does not end up with two imports from one module. An import with
 * a namespace specifier, or with no named specifier, is left alone.
 */
function findMergeTarget(
    imports: readonly AstNode[],
    kind: ImportKind
): MergeTarget | null {
    const sources = sourcesFor(kind);
    let inlineTarget: MergeTarget | null = null;

    for (const declaration of imports) {
        const source = getStringLiteralValue(declaration["source"]);
        const isTypeImport = declaration["importKind"] === "type";
        if (source === null || !sources.has(source)) {
            continue;
        }
        if (kind === "value" && isTypeImport) {
            continue;
        }

        const specifiers = getSpecifiers(declaration);
        if (
            specifiers.some((specifier) => {
                return specifier.type === "ImportNamespaceSpecifier";
            })
        ) {
            continue;
        }

        const named = specifiers.filter((specifier) => {
            return specifier.type === "ImportSpecifier";
        });
        const range = named.at(-1)?.["range"];
        if (!Array.isArray(range) || typeof range[1] !== "number") {
            continue;
        }

        if (kind === "value" || isTypeImport) {
            return { at: range[1], inlineType: false };
        }

        inlineTarget ??= { at: range[1], inlineType: true };
    }

    return inlineTarget;
}

/**
 * Where and what to insert so `name` is imported from the package, and whether
 * it has to be at all.
 *
 * The answer comes from the scope at the place the fix is about to use the
 * name, not from the list of imports. A catch parameter called `err`, a local
 * called `ok`, or an unrelated library's `Maybe` all make a name mean something
 * else there, and adding an import for it would not change that.
 *
 * Where the import goes: appended to an existing import of the same kind from
 * the package; otherwise a new line after the last import; with no import,
 * after the directive prologue (`"use client"` has to stay the first statement
 * of the file or it stops being a directive); with neither, before the first
 * statement.
 *
 * A script file (no `import` or `export`) gets no import: that would turn it
 * into a module and take its globals away. A type is then written by its global
 * name, as it was before this rule added imports; a value, which has no global
 * name, gets no fix. Inside a module, `declare global` and `declare module`
 * blocks get the import like any other code: the file is a module already, and
 * the global name would break a project that does not load the globals entry.
 *
 * @param {ImportSourceCode} sourceCode - Source code of the file, for scopes.
 * @param {unknown} node - The node the fix uses `name` at.
 * @param {string} name - The named export to import, e.g. `"err"`.
 * @param {ImportKind} kind - `"value"` for a helper that is called, `"type"`
 *   for a type that is only named.
 * @returns {ImportPlan} Whether to insert, with the zero-width insertion to
 *   apply.
 */
function planTypeBuddyImport(
    sourceCode: ImportSourceCode,
    node: unknown,
    name: string,
    kind: ImportKind
): ImportPlan {
    const program = getProgram(node);
    if (!program || !isNode(node)) {
        return { kind: "conflict" };
    }

    const binding = findBinding(sourceCode, node, name);
    if (binding !== undefined) {
        const definitions = getDefinitions(binding);
        const isOurs =
            definitions.length > 0 &&
            definitions.every((definition) => {
                return isPackageImport(definition, name, kind);
            });

        return { kind: isOurs ? "present" : "conflict" };
    }

    if (!isModule(program)) {
        return { kind: kind === "type" ? "global" : "conflict" };
    }

    const body = getProgramBody(program);
    const imports = body.filter(isImportDeclaration);

    const merge = findMergeTarget(imports, kind);
    if (merge !== null) {
        return {
            kind: "insert",
            range: [merge.at, merge.at],
            text: `, ${merge.inlineType ? "type " : ""}${name}`
        };
    }

    const statement =
        kind === "type"
            ? `import type { ${name} } from "${PACKAGE_NAME}";`
            : `import { ${name} } from "${PACKAGE_NAME}";`;

    const lastImport = imports.at(-1);
    if (lastImport) {
        const range = lastImport["range"];
        if (!Array.isArray(range) || range.length < 2) {
            return { kind: "conflict" };
        }
        const end: number = range[1];
        return { kind: "insert", range: [end, end], text: `\n${statement}` };
    }

    const lastDirective = body.filter(isDirective).at(-1);
    if (lastDirective) {
        const range = lastDirective["range"];
        if (!Array.isArray(range) || range.length < 2) {
            return { kind: "conflict" };
        }
        const end: number = range[1];
        return { kind: "insert", range: [end, end], text: `\n${statement}` };
    }

    const anchor = body[0] ?? program;
    const range = anchor["range"];
    if (!Array.isArray(range) || range.length < 2) {
        return { kind: "conflict" };
    }

    const start: number = range[0];
    return { kind: "insert", range: [start, start], text: `${statement}\n` };
}

/**
 * Where the first non-directive statement of a body starts, for a fix that
 * wraps the body. `"use cache"` and `"use server"` only count as directives at
 * the very top of the body; wrapping them in a `try` turns them into expression
 * statements that do nothing.
 *
 * @param {unknown} body - A block statement.
 * @returns {number | null} The offset right after the directive prologue, or
 *   the offset right after the opening brace when there is none; null when the
 *   range is unusable.
 */
function getBodyStartAfterDirectives(body: unknown): number | null {
    if (!isNode(body) || !Array.isArray(body["range"])) {
        return null;
    }

    const range: unknown[] = body["range"];
    const opening = range[0];
    if (typeof opening !== "number") {
        return null;
    }

    const statements = Array.isArray(body["body"])
        ? body["body"].filter(isNode)
        : [];
    const lastDirective = statements.filter(isDirective).at(-1);
    if (lastDirective) {
        const directiveRange: unknown = lastDirective["range"];
        if (
            Array.isArray(directiveRange) &&
            typeof directiveRange[1] === "number"
        ) {
            return directiveRange[1];
        }
        return null;
    }

    return opening + 1;
}

type ImportFixer = {
    insertTextBeforeRange(range: [number, number], text: string): unknown;
};

/**
 * Turns import plans into the fixes a rule returns, for one file.
 *
 * `fixes` returns `null` when the name is something else at that spot (or a
 * value cannot be imported there), and a rule then offers no fix at all: a fix
 * that calls the caught `err` or a different library's `Maybe` is worse than
 * none.
 *
 * Every fix that needs an import carries it itself. oxlint applies a fix as a
 * whole or not at all, and drops a fix that overlaps one it applied earlier in
 * the same pass; an import attached to only the first fix of a file would be
 * lost with that fix while the later fixes, which no longer overlap, applied
 * without it. The price is that fixes needing the same import share one
 * insertion point, so one `--fix` pass applies one of them; the next pass finds
 * the import present and applies the rest.
 *
 * @param {ImportSourceCode} sourceCode - Source code of the file, for scopes.
 * @returns {{ fixes: Function }} The planner.
 */
function createImportPlanner(sourceCode: ImportSourceCode) {
    return {
        fixes(
            node: unknown,
            fixer: ImportFixer,
            name: string,
            kind: ImportKind
        ): unknown[] | null {
            const plan = planTypeBuddyImport(sourceCode, node, name, kind);
            if (plan.kind === "conflict") {
                return null;
            }
            if (plan.kind === "insert") {
                return [fixer.insertTextBeforeRange(plan.range, plan.text)];
            }

            return [];
        }
    };
}

export {
    canAddImport,
    createImportPlanner,
    getBodyStartAfterDirectives,
    planTypeBuddyImport
};
export type { ImportFixer, ImportKind, ImportPlan, ImportSourceCode };
