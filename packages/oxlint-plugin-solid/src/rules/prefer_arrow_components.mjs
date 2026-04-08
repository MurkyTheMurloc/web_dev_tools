const FALSE_SENTINEL = false;
const FIRST_INDEX = 0;
const LAST_INDEX = -1;
const FILE_START_RANGE = [FIRST_INDEX, FIRST_INDEX];
const NO_PARAMETERS = 0;
const ONE_PARAMETER = 1;
const PASCAL_CASE_COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const SOLID_IMPORT_SOURCE = "solid-js";

function isAstNode(value) {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof value.type === "string"
    );
}

function hasJsxElementReturnType(node) {
    const rt = node.returnType?.typeAnnotation;
    if (!rt) return false;
    // JSX.Element
    if (
        rt.type === "TSTypeReference" &&
        rt.typeName?.type === "TSQualifiedName" &&
        rt.typeName.left?.name === "JSX" &&
        rt.typeName.right?.name === "Element"
    ) return true;
    // JSX.Element via plain identifier (rare but possible)
    if (rt.type === "TSTypeReference" && rt.typeName?.name === "JSXElement") return true;
    return false;
}

function isFunctionComponent(node) {
    if (
        node.type !== "FunctionDeclaration" ||
        node.async === true ||
        node.generator === true ||
        node.typeParameters
    ) return false;

    if (node.id?.type !== "Identifier") return false;

    // exported PascalCase — classic component
    const isExported = node.parent?.type === "ExportNamedDeclaration";
    if (isExported && isPascalCaseComponentName(node.id.name)) return true;

    // has JSX.Element return type annotation — intent is clear regardless of export/casing
    if (hasJsxElementReturnType(node)) return true;

    return false;
}

// Keep old name as alias so call sites don't need changing
const isExportedFunctionComponent = isFunctionComponent;

function isJsxLikeNode(node) {
    return node?.type === "JSXElement" || node?.type === "JSXFragment";
}

function isPascalCaseComponentName(name) {
    return PASCAL_CASE_COMPONENT_NAME.test(name);
}

function isPropsChildrenMember(node, propsIdentifierName) {
    return (
        node.type === "MemberExpression" &&
        node.object?.type === "Identifier" &&
        node.object.name === propsIdentifierName &&
        node.property?.type === "Identifier" &&
        node.property.name === "children" &&
        node.computed === false
    );
}

function isSolidImportDeclaration(statement) {
    return (
        statement.type === "ImportDeclaration" &&
        statement.source?.value === SOLID_IMPORT_SOURCE
    );
}

function getDesiredSolidTypeName(usesChildren) {
    if (usesChildren) {
        return "ParentComponent";
    }

    return "Component";
}

function getImportedName(specifier) {
    if (specifier.imported.type === "Identifier") {
        return specifier.imported.name;
    }

    return specifier.imported.value;
}

function getPropsParam(functionNode, sourceCode) {
    if (functionNode.params.length === NO_PARAMETERS) {
        return {
            name: "",
            text: "",
        };
    }

    if (functionNode.params.length !== ONE_PARAMETER) {
        return FALSE_SENTINEL;
    }

    const [param] = functionNode.params;
    if (param.type === "Identifier") {
        return {
            name: param.name,
            text: param.name,
        };
    }

    if (param.type === "ObjectPattern") {
        return {
            name: "",
            text: sourceCode.getText(param),
        };
    }

    return FALSE_SENTINEL;
}

function getPropsSuffix(typeReference) {
    if (typeReference === "") {
        return "";
    }

    return `<${typeReference}>`;
}

function getSolidImportDeclarations(programNode) {
    return programNode.body.filter((statement) => {
        return isSolidImportDeclaration(statement);
    });
}

function getTypeReferenceForProps(functionNode, sourceCode) {
    if (functionNode.params.length === NO_PARAMETERS) {
        return "";
    }

    if (functionNode.params.length !== ONE_PARAMETER) {
        return FALSE_SENTINEL;
    }

    const [param] = functionNode.params;
    if (
        (param.type === "Identifier" || param.type === "ObjectPattern") &&
        param.typeAnnotation
    ) {
        return sourceCode.getText(param.typeAnnotation.typeAnnotation);
    }

    return FALSE_SENTINEL;
}

function findLocalTypeName(importDeclarations, desiredTypeName) {
    for (const statement of importDeclarations) {
        for (const specifier of statement.specifiers) {
            if (specifier.type !== "ImportSpecifier") {
                continue;
            }

            if (getImportedName(specifier) === desiredTypeName) {
                return specifier.local.name;
            }
        }
    }

    return "";
}

function hasJsxReturn(body) {
    if (body?.type !== "BlockStatement") {
        return false;
    }

    for (const statement of body.body) {
        if (
            statement.type === "ReturnStatement" &&
            isJsxLikeNode(statement.argument)
        ) {
            return true;
        }
    }

    return false;
}

function visitAstNode(node, visitor) {
    if (!isAstNode(node)) {
        return;
    }

    visitor(node);

    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }

        if (Array.isArray(value)) {
            for (const child of value) {
                if (isAstNode(child)) {
                    visitAstNode(child, visitor);
                }
            }
            continue;
        }

        if (isAstNode(value)) {
            visitAstNode(value, visitor);
        }
    }
}

function usesPropsChildren(functionNode, propsIdentifierName) {
    let found = false;

    visitAstNode(functionNode.body, (node) => {
        if (found || !isPropsChildrenMember(node, propsIdentifierName)) {
            return;
        }

        found = true;
    });

    return found;
}

function getSolidTypeImportInfo(programNode, desiredTypeName) {
    const importDeclarations = getSolidImportDeclarations(programNode);

    return {
        importDeclaration: importDeclarations.at(FIRST_INDEX),
        localTypeName: findLocalTypeName(importDeclarations, desiredTypeName),
    };
}

function getNamedImportSpecifiers(importDeclaration) {
    return importDeclaration.specifiers.filter((specifier) => {
        return specifier.type === "ImportSpecifier";
    });
}

function getValueImportSpecifiers(importDeclaration) {
    return importDeclaration.specifiers.filter((specifier) => {
        return (
            specifier.type === "ImportDefaultSpecifier" ||
            specifier.type === "ImportNamespaceSpecifier"
        );
    });
}

function getTypeKeyword(importDeclaration, sourceCode) {
    if (sourceCode.getText(importDeclaration).startsWith("import type")) {
        return "";
    }

    return "type ";
}

function insertSolidTypeIntoExistingImport({
    desiredTypeName,
    fixer,
    importDeclaration,
    sourceCode,
}) {
    const namedSpecifiers = getNamedImportSpecifiers(importDeclaration);
    if (namedSpecifiers.length > NO_PARAMETERS) {
        const lastNamedSpecifier = namedSpecifiers.at(LAST_INDEX);
        const typeKeyword = getTypeKeyword(importDeclaration, sourceCode);
        return fixer.insertTextAfter(
            lastNamedSpecifier,
            `, ${typeKeyword}${desiredTypeName}`,
        );
    }

    const valueSpecifiers = getValueImportSpecifiers(importDeclaration);
    if (valueSpecifiers.length > NO_PARAMETERS) {
        const lastValueSpecifier = valueSpecifiers.at(LAST_INDEX);
        return fixer.insertTextAfter(
            lastValueSpecifier,
            `, { type ${desiredTypeName} }`,
        );
    }

    return fixer.insertTextBefore(
        importDeclaration,
        `import type { ${desiredTypeName} } from "solid-js";\n`,
    );
}

function createImportFix({ desiredTypeName, fixer, programNode, sourceCode }) {
    const { importDeclaration, localTypeName } = getSolidTypeImportInfo(
        programNode,
        desiredTypeName,
    );

    if (localTypeName !== "") {
        return {
            localTypeName,
            operation: null,
        };
    }

    if (importDeclaration) {
        return {
            localTypeName: desiredTypeName,
            operation: insertSolidTypeIntoExistingImport({
                desiredTypeName,
                fixer,
                importDeclaration,
                sourceCode,
            }),
        };
    }

    return {
        localTypeName: desiredTypeName,
        operation: fixer.insertTextBeforeRange(
            FILE_START_RANGE,
            `import type { ${desiredTypeName} } from "solid-js";\n`,
        ),
    };
}

function buildReplacementText({
    componentName,
    localTypeName,
    propsParam,
    sourceCode,
    typeReference,
    usesChildren,
    functionNode,
    isExported,
}) {
    const exportPrefix = isExported ? "export " : "";
    const propsSuffix = getPropsSuffix(typeReference);
    const paramsText = propsParam.text;
    const bodyText = sourceCode.getText(functionNode.body);

    return `${exportPrefix}const ${componentName}: ${localTypeName}${propsSuffix} = (${paramsText}) => ${bodyText}`;
}

function createRuleFix({
    fixer,
    functionNode,
    localTypeName,
    propsParam,
    sourceCode,
    typeReference,
    usesChildren,
}) {
    const isExported = functionNode.parent?.type === "ExportNamedDeclaration";
    const componentName = functionNode.id.name;
    const replacementText = buildReplacementText({
        componentName,
        functionNode,
        isExported,
        localTypeName,
        propsParam,
        sourceCode,
        typeReference,
        usesChildren,
    });

    // For exported functions, replace the ExportNamedDeclaration (the parent).
    // For non-exported functions, replace only the FunctionDeclaration itself.
    const nodeToReplace = isExported ? functionNode.parent : functionNode;
    return fixer.replaceText(nodeToReplace, replacementText);
}

export const preferArrowComponentsRule = {
    meta: {
        docs: {
            description:
                "Prefer Solid components written as arrow consts typed with Component or ParentComponent.",
            recommended: false,
        },
        fixable: "code",
        schema: [],
        type: "suggestion",
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const programNode = sourceCode.ast;

        return {
            FunctionDeclaration(node) {
                if (
                    !isExportedFunctionComponent(node) ||
                    !hasJsxReturn(node.body)
                ) {
                    return;
                }

                const propsParam = getPropsParam(node, sourceCode);
                const typeReference = getTypeReferenceForProps(
                    node,
                    sourceCode,
                );
                if (
                    propsParam === FALSE_SENTINEL ||
                    typeReference === FALSE_SENTINEL
                ) {
                    return;
                }

                const usesChildren =
                    propsParam.name !== "" &&
                    usesPropsChildren(node, propsParam.name);
                const desiredTypeName = getDesiredSolidTypeName(usesChildren);

                const { importDeclaration, localTypeName } = getSolidTypeImportInfo(
                    programNode,
                    desiredTypeName,
                );
                const resolvedTypeName = localTypeName !== "" ? localTypeName : desiredTypeName;
                const needsNewImport = localTypeName === "" && !importDeclaration;

                context.report({
                    fix(fixer) {
                        const isExported = node.parent?.type === "ExportNamedDeclaration";
                        const componentName = node.id.name;
                        const propsSuffix = getPropsSuffix(typeReference);
                        const paramsText = propsParam.text;
                        const bodyText = sourceCode.getText(node.body);
                        const exportPrefix = isExported ? "export " : "";

                        // If we need a new import AND the function is not exported,
                        // prepend the import declaration directly into the replacement text
                        // to avoid multi-range fix conflicts.
                        const importPrefix = needsNewImport
                            ? `import type { ${desiredTypeName} } from "solid-js";\n`
                            : "";

                        const replacementText = `${importPrefix}${exportPrefix}const ${componentName}: ${resolvedTypeName}${propsSuffix} = (${paramsText}) => ${bodyText}`;
                        const nodeToReplace = isExported ? node.parent : node;

                        if (!needsNewImport && localTypeName === "" && importDeclaration) {
                            // Need to add to existing import — use two fixes only when
                            // the import is AFTER the function (safe, no overlap).
                            // Otherwise embed the import in the replacement.
                            const importEnd = importDeclaration.range?.[1] ?? 0;
                            const funcStart = nodeToReplace.range?.[0] ?? 0;
                            if (importEnd < funcStart) {
                                const typeKeyword = getTypeKeyword(importDeclaration, sourceCode);
                                const namedSpecifiers = getNamedImportSpecifiers(importDeclaration);
                                const lastSpec = namedSpecifiers.at(LAST_INDEX);
                                const importOp = lastSpec
                                    ? fixer.insertTextAfter(lastSpec, `, ${typeKeyword}${desiredTypeName}`)
                                    : fixer.insertTextBefore(importDeclaration, `import type { ${desiredTypeName} } from "solid-js";\n`);
                                return [
                                    fixer.replaceText(nodeToReplace, replacementText),
                                    importOp,
                                ];
                            }
                        }

                        return fixer.replaceText(nodeToReplace, replacementText);
                    },
                    message:
                        "Prefer export const components typed as Component<Props> or ParentComponent<Props>.",
                    node,
                });
            },
        };
    },
};
