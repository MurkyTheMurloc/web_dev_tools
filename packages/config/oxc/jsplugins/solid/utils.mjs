import { findVariable } from "./compat.mjs";

const DOM_ELEMENT_REGEX = /^[a-z]/;
const PROPS_REGEX = /[pP]rops/;
const FUNCTION_TYPES = [
    "FunctionExpression",
    "ArrowFunctionExpression",
    "FunctionDeclaration",
];
const PROGRAM_OR_FUNCTION_TYPES = ["Program", ...FUNCTION_TYPES];

export function isDOMElementName(name) {
    return DOM_ELEMENT_REGEX.test(name);
}

export function isPropsByName(name) {
    return PROPS_REGEX.test(name);
}

export function formatList(strings) {
    if (strings.length === 0) {
        return "";
    }

    if (strings.length === 1) {
        return `'${strings[0]}'`;
    }

    if (strings.length === 2) {
        return `'${strings[0]}' and '${strings[1]}'`;
    }

    const last = strings.length - 1;
    return `${strings
        .slice(0, last)
        .map((stringValue) => {
            return `'${stringValue}'`;
        })
        .join(", ")}, and '${strings[last]}'`;
}

export function find(node, predicate) {
    let currentNode = node;

    while (currentNode) {
        if (predicate(currentNode)) {
            return currentNode;
        }

        currentNode = currentNode.parent;
    }

    return null;
}

export function findParent(node, predicate) {
    return node.parent ? find(node.parent, predicate) : null;
}

export function trace(node, context) {
    if (node.type !== "Identifier") {
        return node;
    }

    const variable = findVariable(context, node);
    if (!variable) {
        return node;
    }

    const definition = variable.defs[0];
    switch (definition?.type) {
        case "FunctionName":
        case "ClassName":
        case "ImportBinding":
            return definition.node;
        case "Variable":
            if (
                (definition.node.parent.kind === "const" ||
                    variable.references.every((reference) => {
                        return reference.init || reference.isReadOnly();
                    })) &&
                definition.node.id.type === "Identifier" &&
                definition.node.init
            ) {
                return trace(definition.node.init, context);
            }
            break;
        default:
            break;
    }

    return node;
}

export function ignoreTransparentWrappers(node, up = false) {
    if (
        node.type === "TSAsExpression" ||
        node.type === "TSNonNullExpression" ||
        node.type === "TSSatisfiesExpression"
    ) {
        const nextNode = up ? node.parent : node.expression;
        if (nextNode) {
            return ignoreTransparentWrappers(nextNode, up);
        }
    }

    return node;
}

export function isFunctionNode(node) {
    return Boolean(node) && FUNCTION_TYPES.includes(node.type);
}

export function isProgramOrFunctionNode(node) {
    return Boolean(node) && PROGRAM_OR_FUNCTION_TYPES.includes(node.type);
}

export function isJSXElementOrFragment(node) {
    return node?.type === "JSXElement" || node?.type === "JSXFragment";
}

export function getFunctionName(node) {
    if (
        (node.type === "FunctionDeclaration" ||
            node.type === "FunctionExpression") &&
        node.id != null
    ) {
        return node.id.name;
    }

    if (
        node.parent?.type === "VariableDeclarator" &&
        node.parent.id.type === "Identifier"
    ) {
        return node.parent.id.name;
    }

    return null;
}

export function findInScope(node, scope, predicate) {
    const foundNode = find(node, (innerNode) => {
        return innerNode === scope || predicate(innerNode);
    });

    return foundNode === scope && !predicate(node) ? null : foundNode;
}

export function getCommentBefore(node, sourceCode) {
    return sourceCode.getCommentsBefore(node).find((comment) => {
        return comment.loc.end.line >= node.loc.start.line - 1;
    });
}

export function getCommentAfter(node, sourceCode) {
    return sourceCode.getCommentsAfter(node).find((comment) => {
        return comment.loc.start.line === node.loc.end.line;
    });
}

export function trackImports(fromModule = /^solid-js(?:\/?|\b)/) {
    const importMap = new Map();

    function handleImportDeclaration(node) {
        if (!fromModule.test(node.source.value)) {
            return;
        }

        for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier") {
                importMap.set(specifier.imported.name, specifier.local.name);
            }
        }
    }

    function matchImport(imports, value) {
        const importList = Array.isArray(imports) ? imports : [imports];
        return importList.find((importName) => {
            return importMap.get(importName) === value;
        });
    }

    return {
        handleImportDeclaration,
        matchImport,
    };
}

export function appendImports(fixer, sourceCode, importNode, identifiers) {
    const identifiersString = identifiers.join(", ");
    const namedSpecifier = importNode.specifiers
        .slice()
        .reverse()
        .find((specifier) => {
            return specifier.type === "ImportSpecifier";
        });

    if (namedSpecifier) {
        return fixer.insertTextAfter(namedSpecifier, `, ${identifiersString}`);
    }

    const otherSpecifier = importNode.specifiers.find((specifier) => {
        return (
            specifier.type === "ImportDefaultSpecifier" ||
            specifier.type === "ImportNamespaceSpecifier"
        );
    });

    if (otherSpecifier) {
        return fixer.insertTextAfter(
            otherSpecifier,
            `, { ${identifiersString} }`,
        );
    }

    if (importNode.specifiers.length === 0) {
        const [importToken, maybeBrace] = sourceCode.getFirstTokens(
            importNode,
            {
                count: 2,
            },
        );

        if (maybeBrace?.value === "{") {
            return fixer.insertTextAfter(maybeBrace, ` ${identifiersString} `);
        }

        return importToken
            ? fixer.insertTextAfter(
                  importToken,
                  ` { ${identifiersString} } from`,
              )
            : null;
    }

    return null;
}

export function insertImports(
    fixer,
    sourceCode,
    source,
    identifiers,
    aboveImport,
    isType = false,
) {
    const identifiersString = identifiers.join(", ");
    const programNode = sourceCode.ast;
    const firstImport =
        aboveImport ||
        programNode.body.find((node) => {
            return node.type === "ImportDeclaration";
        });

    if (firstImport) {
        return fixer.insertTextBeforeRange(
            (getCommentBefore(firstImport, sourceCode) ?? firstImport).range,
            `import ${isType ? "type " : ""}{ ${identifiersString} } from "${source}";\n`,
        );
    }

    return fixer.insertTextBeforeRange(
        [0, 0],
        `import ${isType ? "type " : ""}{ ${identifiersString} } from "${source}";\n`,
    );
}

export function removeSpecifier(fixer, sourceCode, specifier, pure = true) {
    const declaration = specifier.parent;
    if (declaration.specifiers.length === 1 && pure) {
        return fixer.remove(declaration);
    }

    const maybeComma = sourceCode.getTokenAfter(specifier);
    if (maybeComma?.value === ",") {
        return fixer.removeRange([specifier.range[0], maybeComma.range[1]]);
    }

    return fixer.remove(specifier);
}

export function jsxPropName(prop) {
    if (prop.name.type === "JSXNamespacedName") {
        return `${prop.name.namespace.name}:${prop.name.name.name}`;
    }

    return prop.name.name;
}

export function* jsxGetAllProps(props) {
    for (const attribute of props) {
        if (
            attribute.type === "JSXSpreadAttribute" &&
            attribute.argument.type === "ObjectExpression"
        ) {
            for (const property of attribute.argument.properties) {
                if (property.type !== "Property") {
                    continue;
                }

                if (property.key.type === "Identifier") {
                    yield [property.key.name, property.key];
                    continue;
                }

                if (property.key.type === "Literal") {
                    yield [String(property.key.value), property.key];
                }
            }

            continue;
        }

        if (attribute.type === "JSXAttribute") {
            yield [jsxPropName(attribute), attribute.name];
        }
    }
}

export function jsxHasProp(props, prop) {
    for (const [propName] of jsxGetAllProps(props)) {
        if (propName === prop) {
            return true;
        }
    }

    return false;
}

export function jsxGetProp(props, prop) {
    return props.find((attribute) => {
        return (
            attribute.type !== "JSXSpreadAttribute" &&
            prop === jsxPropName(attribute)
        );
    });
}
