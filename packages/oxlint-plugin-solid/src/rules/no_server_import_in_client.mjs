import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const SERVER_DIRECTORY = join("src", "server");
const GIT_ENTRY = ".git";
const PACKAGE_MANIFEST = "package.json";
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const CLIENT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST_FILE = /\.(?:test|spec)\.[^/]+$/;
const ALIAS_PREFIX = "~/";
const USE_SERVER_DIRECTIVE = "use server";
// The byte order mark, the line terminators (LF, CR, U+2028, U+2029) and the
// white space of ECMAScript (tab, VT, FF, BOM and every Unicode Zs, which
// includes the plain space). The code points that cannot be seen are written
// as escapes, so no invisible character sits in the source.
const BYTE_ORDER_MARK = /^\u{FEFF}/u;
const LINE_BREAK = /[\n\r\u{2028}\u{2029}]/u;
const WHITESPACE = /[\t\v\f\u{FEFF}\p{Zs}]/u;
// A whole identifier, so that `in_progress()` is not the operator `in`.
const WORD = /^[\p{ID_Continue}$\u{200C}\u{200D}]+/u;
// One more than the longest operator word, so a longer identifier that starts
// with one (`instanceofx`) is not cut down to it.
const LONGEST_OPERATOR_WORD = 10;
const WORD_SLICE_LENGTH = LONGEST_OPERATOR_WORD + 1;
// Words that go on with an expression after a string: `"use server" in x`.
const OPERATOR_WORDS = new Set(["as", "in", "instanceof", "satisfies"]);
// The first character of what follows a string on the next line, when it goes
// on with the string as an expression (`.length`, `(...)`, `* 2`, a tagged
// template, ...) instead of starting a new statement.
const CONTINUING_CHARACTERS = new Set([
    ".",
    "(",
    "[",
    "*",
    "%",
    "<",
    ">",
    "=",
    "?",
    ",",
    "&",
    "|",
    "^",
    "/",
    "`",
]);

function isDirectory(path) {
    return existsSync(path) && statSync(path).isDirectory();
}

function isFile(path) {
    return existsSync(path) && statSync(path).isFile();
}

/**
 * Whether `directory` is where a repository or a workspace ends: it holds a
 * `.git` or a package.json with `workspaces`. A `src/server` further up belongs
 * to something else (a home directory, an outer checkout).
 */
function isProjectBoundary(directory) {
    if (existsSync(join(directory, GIT_ENTRY))) {
        return true;
    }

    const manifest = join(directory, PACKAGE_MANIFEST);
    if (!isFile(manifest)) {
        return false;
    }

    try {
        const { workspaces } = JSON.parse(readFileSync(manifest, "utf8"));
        return typeof workspaces === "object" && workspaces !== null;
    } catch {
        return false;
    }
}

// Directory -> the project root found from it (or null). One oxlint run lints
// many files of the same folders, and every lookup stats each folder above.
const projectRootCache = new Map();

/**
 * Nearest directory at or above `directory` that holds `src/server`: the
 * project the client file belongs to. The nearest package.json is not it: one
 * can sit in any folder below the project, and it does not say where the server
 * code is. The walk stops at the first folder with a `.git` or a package.json
 * with `workspaces`. The answer is cached for the life of the process: a
 * `src/server` made while a language server runs is found after a restart.
 */
function findProjectRoot(directory) {
    if (projectRootCache.has(directory)) {
        return projectRootCache.get(directory);
    }

    let root = null;
    if (isDirectory(join(directory, SERVER_DIRECTORY))) {
        root = directory;
    } else if (!isProjectBoundary(directory)) {
        const parent = dirname(directory);
        if (parent !== directory) {
            root = findProjectRoot(parent);
        }
    }

    projectRootCache.set(directory, root);

    return root;
}

/**
 * The file an import path points at, trying the extensions the bundler would. A
 * `.js` specifier names the `.ts` source next to it.
 */
function findModuleFile(basePath) {
    const withoutJsExtension = basePath.replace(/\.[cm]?jsx?$/, "");
    const candidates = [
        basePath,
        ...EXTENSIONS.map((extension) => `${basePath}${extension}`),
        ...EXTENSIONS.map((extension) => `${withoutJsExtension}${extension}`),
        ...EXTENSIONS.map((extension) => join(basePath, `index${extension}`)),
    ];

    return candidates.find(isFile) ?? null;
}

/**
 * The index after the whitespace and comments that start at `start`, and
 * whether a line break was among them.
 */
function skipTrivia(text, start) {
    let index = start;
    let sawLineBreak = false;

    while (index < text.length) {
        const character = text[index];
        if (LINE_BREAK.test(character)) {
            sawLineBreak = true;
            index += 1;
        } else if (WHITESPACE.test(character)) {
            index += 1;
        } else if (text.startsWith("//", index)) {
            while (index < text.length && !LINE_BREAK.test(text[index])) {
                index += 1;
            }
        } else if (text.startsWith("/*", index)) {
            const end = text.indexOf("*/", index + 2);
            const stop = end === -1 ? text.length : end + 2;
            sawLineBreak ||= LINE_BREAK.test(text.slice(index, stop));
            index = stop;
        } else {
            break;
        }
    }

    return { index, sawLineBreak };
}

/**
 * Whether the code at `index`, on a new line, goes on with the expression
 * before it, so that no semicolon is inserted there.
 */
function continuesExpression(text, index) {
    const character = text[index];
    if (character === "+" || character === "-") {
        // `++x` and `--x` start a statement of their own.
        return text[index + 1] !== character;
    }

    if (character === "!") {
        return text[index + 1] === "=";
    }

    if (CONTINUING_CHARACTERS.has(character)) {
        return true;
    }

    // The whole word: `in_progress()` starts a statement, `in x` does not.
    const word = WORD.exec(text.slice(index, index + WORD_SLICE_LENGTH));

    return word !== null && OPERATOR_WORDS.has(word[0]);
}

/**
 * The index of the string literal's closing quote, or -1 when the line ends
 * first: a string literal cannot span lines.
 */
function findStringEnd(text, start) {
    const quote = text[start];
    let end = start + 1;

    while (end < text.length && text[end] !== quote) {
        if (LINE_BREAK.test(text[end])) {
            return -1;
        }

        end += text[end] === "\\" ? 2 : 1;
    }

    return end < text.length ? end : -1;
}

/**
 * Whether `"use server"` is one of the directives that open the module: the
 * directive prologue, which is every string-literal statement at the top (`"use
 * strict"; "use server";`) and ends with the first statement that is anything
 * else. `"use server".length;`, `("use server");` and an escaped
 * `"use\x20server"` are an expression and another directive, not this one.
 */
function hasUseServerDirective(source) {
    const text = source.replace(BYTE_ORDER_MARK, "");
    let index = 0;
    if (text.startsWith("#!")) {
        const lineEnd = text.search(LINE_BREAK);
        index = lineEnd === -1 ? text.length : lineEnd;
    }

    while (index < text.length) {
        index = skipTrivia(text, index).index;
        const quote = text[index];
        if (quote !== '"' && quote !== "'") {
            return false;
        }

        const end = findStringEnd(text, index);
        if (end === -1) {
            return false;
        }

        const after = skipTrivia(text, end + 1);
        const next = text[after.index];
        const endsStatement =
            next === ";" ||
            after.index >= text.length ||
            (after.sawLineBreak && !continuesExpression(text, after.index));
        if (!endsStatement) {
            return false;
        }

        if (text.slice(index + 1, end) === USE_SERVER_DIRECTIVE) {
            return true;
        }

        index = next === ";" ? after.index + 1 : after.index;
    }

    return false;
}

function startsWithUseServer(filePath) {
    return hasUseServerDirective(readFileSync(filePath, "utf8"));
}

function isInside(path, directory) {
    return path.startsWith(`${directory}${sep}`);
}

function resolveImport(specifier, filename, projectRoot) {
    if (specifier.startsWith(ALIAS_PREFIX)) {
        return resolve(
            projectRoot,
            "src",
            specifier.slice(ALIAS_PREFIX.length),
        );
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
        return resolve(dirname(filename), specifier);
    }

    return null;
}

/**
 * The module specifier a node spells out: a string literal, or a template
 * literal without substitutions (`` `~/server/db` ``). Null for anything that
 * is only known at run time.
 */
function getStaticSpecifier(node) {
    if (node?.type === "Literal" && typeof node.value === "string") {
        return node.value;
    }

    if (
        node?.type === "TemplateLiteral" &&
        node.expressions.length === 0 &&
        node.quasis.length === 1
    ) {
        return node.quasis[0].value.cooked ?? null;
    }

    return null;
}

export const noServerImportInClientRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow importing modules from src/server/ into client code unless they are use-server modules.",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            serverImportInClient:
                '\'{{specifier}}\' lives under src/server/ but does not have the "use server" directive, so importing it into client code ships server-only code to the browser. Import a server function module instead (a `"use server";` directive at the top, async exports only), and keep database clients and secrets inside it.',
        },
    },
    defaultOptions: [],
    create(context) {
        const filename = resolve(context.filename ?? context.getFilename());
        const projectRoot = findProjectRoot(dirname(filename));

        // Server modules, tests and non-code files may import anything.
        if (
            projectRoot === null ||
            !CLIENT_FILE.test(filename) ||
            TEST_FILE.test(filename) ||
            isInside(filename, join(projectRoot, SERVER_DIRECTORY))
        ) {
            return {};
        }

        const serverDirectory = join(projectRoot, SERVER_DIRECTORY);

        function check(sourceNode) {
            const specifier = getStaticSpecifier(sourceNode);
            if (specifier === null) {
                return;
            }

            const basePath = resolveImport(specifier, filename, projectRoot);
            if (basePath === null) {
                return;
            }

            const target = findModuleFile(basePath);
            // A missing file is the resolver's problem, not this rule's.
            if (
                target === null ||
                !isInside(target, serverDirectory) ||
                startsWithUseServer(target)
            ) {
                return;
            }

            context.report({
                node: sourceNode,
                messageId: "serverImportInClient",
                data: { specifier },
            });
        }

        return {
            ImportDeclaration(node) {
                // Types are erased, nothing reaches the bundle.
                if (node.importKind !== "type") {
                    check(node.source);
                }
            },
            ExportNamedDeclaration(node) {
                if (node.exportKind !== "type") {
                    check(node.source);
                }
            },
            ExportAllDeclaration(node) {
                if (node.exportKind !== "type") {
                    check(node.source);
                }
            },
            ImportExpression(node) {
                check(node.source);
            },
            CallExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "require" &&
                    node.arguments.length === 1
                ) {
                    check(node.arguments[0]);
                }
            },
        };
    },
};
