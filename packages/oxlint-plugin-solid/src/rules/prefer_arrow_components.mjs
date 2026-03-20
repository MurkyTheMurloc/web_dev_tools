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

function isExportedFunctionComponent(node) {
    return (
        node.type === "FunctionDeclaration" &&
        node.id?.type === "Identifier" &&
        isPascalCaseComponentName(node.id.name) &&
        node.parent?.type === "ExportNamedDeclaration" &&
        node.async !== true &&
        node.generator !== true &&
        !node.typeParameters
    );
}

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

function getPropsParam(functionNode) {
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
    if (param.type !== "Identifier") {
        return FALSE_SENTINEL;
    }

    return {
        name: param.name,
        text: param.name,
    };
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
    if (param.type !== "Identifier" || !param.typeAnnotation) {
        return FALSE_SENTINEL;
    }

    return sourceCode.getText(param.typeAnnotation.typeAnnotation);
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
}) {
    const asyncPrefix = "";
    const childrenComment = usesChildren ? "" : "";
    const propsSuffix = getPropsSuffix(typeReference);
    const paramsText = propsParam.text;
    const bodyText = sourceCode.getText(functionNode.body);

    return `export const ${componentName}: ${localTypeName}${propsSuffix} = (${paramsText}) => ${bodyText}${asyncPrefix}${childrenComment}`;
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
    const componentName = functionNode.id.name;
    const replacementText = buildReplacementText({
        componentName,
        functionNode,
        localTypeName,
        propsParam,
        sourceCode,
        typeReference,
        usesChildren,
    });

    return fixer.replaceText(functionNode.parent, replacementText);
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

                const propsParam = getPropsParam(node);
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

                context.report({
                    fix(fixer) {
                        const importFix = createImportFix({
                            desiredTypeName,
                            fixer,
                            programNode,
                            sourceCode,
                        });
                        const replacementFix = createRuleFix({
                            fixer,
                            functionNode: node,
                            localTypeName: importFix.localTypeName,
                            propsParam,
                            sourceCode,
                            typeReference,
                            usesChildren,
                        });

                        return [
                            ...(importFix.operation
                                ? [importFix.operation]
                                : []),
                            replacementFix,
                        ];
                    },
                    message:
                        "Prefer export const components typed as Component<Props> or ParentComponent<Props>.",
                    node,
                });
            },
        };
    },
};
