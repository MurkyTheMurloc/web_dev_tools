import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const SERVER_DIRECTORY = join("src", "server");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const CLIENT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST_FILE = /\.(?:test|spec)\.[^/]+$/;
const ALIAS_PREFIX = "~/";
const USE_SERVER = /^(?:["']use server["'])/;
// Whitespace and comments may precede the directive; anything else means it is
// not the first statement.
const LEADING_TRIVIA = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)+/;

/** Nearest directory at or above `directory` that holds a package.json. */
function findProjectRoot(directory) {
    let current = directory;

    while (!existsSync(join(current, "package.json"))) {
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }

        current = parent;
    }

    return current;
}

function isFile(path) {
    return existsSync(path) && statSync(path).isFile();
}

/**
 * The file an import path points at, trying the extensions the bundler would.
 * A `.js` specifier names the `.ts` source next to it.
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

function startsWithUseServer(filePath) {
    let text = readFileSync(filePath, "utf8").replace(/^﻿/, "");

    for (;;) {
        const trivia = LEADING_TRIVIA.exec(text);
        if (!trivia) {
            break;
        }

        text = text.slice(trivia[0].length);
    }

    return USE_SERVER.test(text);
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
                "'{{specifier}}' lives under src/server/ but does not start with the \"use server\" directive, so importing it into client code ships server-only code to the browser. Import a server function module instead (first statement `\"use server\";`, async exports only), and keep database clients and secrets inside it.",
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
            if (
                sourceNode?.type !== "Literal" ||
                typeof sourceNode.value !== "string"
            ) {
                return;
            }

            const basePath = resolveImport(
                sourceNode.value,
                filename,
                projectRoot,
            );
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
                data: { specifier: sourceNode.value },
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
        };
    },
};
