// A `.tsx`/`.jsx` file that exports a component is named after it
// (`Navigate.tsx` exports `Navigate`); one that only uses JSX stays snake_case
// (`solid_ssr_renderer.tsx`). unicorn/filename-case allows both cases for
// these files, this rule decides which one applies. Route folders follow the
// router's own naming and are skipped through `ignore`.
import { basename, relative } from "node:path";

const JSX_FILE = /\.[jt]sx$/u;
const PASCAL_NAME = /^[A-Z]/u;
// Router files follow the router's naming; fixtures and tests export many
// throwaway components and are named after what they test.
const DEFAULT_IGNORE = [
    "**/pages/**",
    "**/routes/**",
    "**/*.fixture.*",
    "**/*.test.*",
    "**/*.spec.*"
];

function isFunction(node) {
    let inner = node;
    // `const Counter = (() => …) satisfies Component`
    while (
        inner?.type === "TSAsExpression" ||
        inner?.type === "TSSatisfiesExpression" ||
        inner?.type === "ParenthesizedExpression"
    ) {
        inner = inner.expression;
    }
    return (
        inner?.type === "ArrowFunctionExpression" ||
        inner?.type === "FunctionExpression" ||
        inner?.type === "FunctionDeclaration"
    );
}

// ponytail: `**`, `*` and `?` only; no braces or character classes.
function globToRegExp(glob) {
    const source = glob
        .split(/(\*\*\/|\*\*|\*|\?)/u)
        .map((part) => {
            if (part === "**/") {
                return "(?:.*/)?";
            }
            if (part === "**") {
                return ".*";
            }
            if (part === "*") {
                return "[^/]*";
            }
            if (part === "?") {
                return "[^/]";
            }
            return part.replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`);
        })
        .join("");
    return new RegExp(`^${source}$`, "u");
}

export function toSnakeCase(name) {
    const leading = /^_*/u.exec(name)[0];
    return (
        leading +
        name
            .slice(leading.length)
            .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
            .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2")
            .replaceAll(/[\s-]+/gu, "_")
            .replaceAll(/_+/gu, "_")
            .toLowerCase()
    );
}

// Top-level names bound to a function, exported or not, so `export { C }`
// and `export default C` can be resolved.
function collectFunctionBindings(program) {
    const functions = new Set();
    for (const statement of program.body) {
        const declaration =
            statement.type === "ExportNamedDeclaration"
                ? statement.declaration
                : statement;
        if (declaration?.type === "FunctionDeclaration" && declaration.id) {
            functions.add(declaration.id.name);
        }
        if (declaration?.type === "VariableDeclaration") {
            for (const declarator of declaration.declarations) {
                if (
                    declarator.id.type === "Identifier" &&
                    isFunction(declarator.init)
                ) {
                    functions.add(declarator.id.name);
                }
            }
        }
    }
    return functions;
}

// The exported components: `{ name, node }` for every PascalCase export bound
// to a function, and the default export separately. Type-only exports are
// left out. A PascalCase re-export of a local module (`export { default as
// Counter } from "./CounterComponent"`) counts as the component it names: the
// module it comes from is not visible here, and the name is the convention.
function collectComponents(program) {
    const functions = collectFunctionBindings(program);
    const named = [];
    let defaultComponent = null;
    for (const statement of program.body) {
        if (
            statement.type === "ExportNamedDeclaration" &&
            statement.exportKind !== "type" &&
            statement.source === null
        ) {
            const { declaration } = statement;
            if (declaration?.type === "FunctionDeclaration" && declaration.id) {
                named.push({ name: declaration.id.name, node: declaration.id });
            }
            if (declaration?.type === "VariableDeclaration") {
                for (const declarator of declaration.declarations) {
                    if (
                        declarator.id.type === "Identifier" &&
                        isFunction(declarator.init)
                    ) {
                        named.push({
                            name: declarator.id.name,
                            node: declarator.id
                        });
                    }
                }
            }
            for (const specifier of statement.specifiers) {
                if (
                    specifier.exportKind !== "type" &&
                    functions.has(specifier.local.name) &&
                    specifier.exported.type === "Identifier" &&
                    specifier.exported.name !== "default"
                ) {
                    named.push({
                        name: specifier.exported.name,
                        node: specifier.exported
                    });
                }
            }
        }
        if (
            statement.type === "ExportNamedDeclaration" &&
            statement.exportKind !== "type" &&
            // A local module re-exported under its component's name; a
            // re-export from a package (`export { Show } from "solid-js"`)
            // is not this file's component.
            typeof statement.source?.value === "string" &&
            statement.source.value.startsWith(".")
        ) {
            for (const specifier of statement.specifiers) {
                if (
                    specifier.exportKind !== "type" &&
                    specifier.exported.type === "Identifier" &&
                    /^[A-Z]/u.test(specifier.exported.name)
                ) {
                    named.push({
                        name: specifier.exported.name,
                        node: specifier.exported
                    });
                }
            }
        }
        if (statement.type === "ExportDefaultDeclaration") {
            const { declaration } = statement;
            if (isFunction(declaration) && declaration.id) {
                defaultComponent = {
                    name: declaration.id.name,
                    node: declaration.id
                };
            }
            if (
                declaration.type === "Identifier" &&
                functions.has(declaration.name)
            ) {
                defaultComponent = {
                    name: declaration.name,
                    node: declaration
                };
            }
        }
    }
    const isComponent = (entry) => PASCAL_NAME.test(entry.name);
    return {
        defaultComponent:
            defaultComponent !== null && isComponent(defaultComponent)
                ? defaultComponent
                : null,
        named: named.filter(isComponent)
    };
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Name a `.tsx`/`.jsx` file after the component it exports, and keep files without a component snake_case.",
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-solid#solidfilename-matches-export"
        },
        schema: [
            {
                type: "object",
                properties: {
                    ignore: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            "Globs of files the rule skips; route folders follow the router's naming."
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            componentName:
                "The file `{{file}}` exports the component `{{component}}`, so imports and the file tree disagree on its name and searching for the component does not find the file. Fix: rename the file to `{{expected}}`. Do not: rename the export to match the file; the component's name is the source of truth.",
            snakeCase:
                "The file `{{file}}` exports no component, but a PascalCase name marks a component file, so readers and agents look for a component that is not there. Fix: rename the file to `{{expected}}`. Do not: export a component only to justify the name."
        }
    },
    defaultOptions: [],
    create(context) {
        const filename = context.filename ?? context.getFilename();
        const file = basename(filename);
        if (!JSX_FILE.test(file)) {
            return {};
        }
        const ignore = (context.options[0]?.ignore ?? DEFAULT_IGNORE).map(
            globToRegExp
        );
        const paths = [
            filename.replaceAll("\\", "/"),
            relative(context.cwd ?? process.cwd(), filename).replaceAll(
                "\\",
                "/"
            )
        ];
        if (ignore.some((glob) => paths.some((path) => glob.test(path)))) {
            return {};
        }
        // `Counter.island.tsx`, `island_hydration.test.tsx`: the name is the
        // part before the first dot, the rest stays as it is.
        const dot = file.indexOf(".");
        const base = file.slice(0, dot);
        const rest = file.slice(dot);
        if (base === "index") {
            return {};
        }

        return {
            Program(program) {
                const { defaultComponent, named } = collectComponents(program);
                if (defaultComponent !== null || named.length > 0) {
                    const target = defaultComponent ?? named[0];
                    if (
                        defaultComponent === null
                            ? named.some((entry) => entry.name === base)
                            : defaultComponent.name === base
                    ) {
                        return;
                    }
                    context.report({
                        data: {
                            component: target.name,
                            expected: `${target.name}${rest}`,
                            file
                        },
                        messageId: "componentName",
                        node: target.node
                    });
                    return;
                }
                const expected = toSnakeCase(base);
                if (expected !== base) {
                    context.report({
                        data: { expected: `${expected}${rest}`, file },
                        loc: {
                            end: { column: 0, line: 1 },
                            start: { column: 0, line: 1 }
                        },
                        messageId: "snakeCase"
                    });
                }
            }
        };
    }
};
