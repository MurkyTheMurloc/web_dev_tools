import { appendImports, canTakeSpecifier, insertImports } from "../utils.mjs";

const FALSE_SENTINEL = false;
const FIRST_INDEX = 0;
const NO_PARAMETERS = 0;
const NO_ITEMS = 0;
const ONE_PARAMETER = 1;
const PASCAL_CASE_COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const SOLID_IMPORT_SOURCE = "solid-js";
const SOLID_COMPONENT_TYPES = ["Component", "ParentComponent"];

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
    )
        return true;
    // JSX.Element via plain identifier (rare but possible)
    if (rt.type === "TSTypeReference" && rt.typeName?.name === "JSXElement")
        return true;
    // Solid 2.0: `Element` from solid-js is the renderer-neutral return type,
    // and `JSX` now lives in the renderer package.
    if (rt.type === "TSTypeReference" && rt.typeName?.name === "Element")
        return true;
    return false;
}

function isFunctionComponent(node) {
    if (
        node.type !== "FunctionDeclaration" ||
        node.async === true ||
        node.generator === true ||
        node.typeParameters
    )
        return false;

    if (node.id?.type !== "Identifier") return false;

    // exported PascalCase — classic component
    const isExported = node.parent?.type === "ExportNamedDeclaration";
    if (isExported && isPascalCaseComponentName(node.id.name)) return true;

    // has JSX.Element return type annotation — intent is clear regardless of export/casing
    if (hasJsxElementReturnType(node)) return true;

    return false;
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

// Names the file declares at the top level (imports, types, classes,
// functions, variables), exported or not.
function getTopLevelNames(programNode) {
    const names = new Set();
    for (const statement of programNode.body) {
        if (statement.type === "ImportDeclaration") {
            for (const specifier of statement.specifiers) {
                names.add(specifier.local.name);
            }
            continue;
        }

        const declaration =
            statement.type === "ExportNamedDeclaration" ||
            statement.type === "ExportDefaultDeclaration"
                ? statement.declaration
                : statement;
        if (declaration?.type === "VariableDeclaration") {
            for (const declarator of declaration.declarations) {
                if (declarator.id.type === "Identifier") {
                    names.add(declarator.id.name);
                }
            }
        } else if (declaration?.id?.type === "Identifier") {
            names.add(declaration.id.name);
        }
    }

    return names;
}

// What the module does in one walk: the position of the first JSX element of
// each name, and the Solid component types it writes as a type reference
// (`Component<Props>`) without declaring or importing them.
function scanProgram(programNode) {
    const firstJsxUse = new Map();
    const referencedTypes = new Set();
    const declared = getTopLevelNames(programNode);

    visitAstNode(programNode, (node) => {
        if (
            node.type === "JSXIdentifier" &&
            (node.parent?.type === "JSXOpeningElement" ||
                node.parent?.type === "JSXClosingElement" ||
                node.parent?.type === "JSXMemberExpression") &&
            !firstJsxUse.has(node.name)
        ) {
            firstJsxUse.set(node.name, node.range[FIRST_INDEX]);
        }

        if (
            node.type === "TSTypeReference" &&
            node.typeName?.type === "Identifier" &&
            SOLID_COMPONENT_TYPES.includes(node.typeName.name) &&
            !declared.has(node.typeName.name)
        ) {
            referencedTypes.add(node.typeName.name);
        }
    });

    return { firstJsxUse, referencedTypes };
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
        const candidates = [];

        // `function F` is hoisted, `const F` is not: a read of `F` that stands
        // before the declaration (`export const routes = [{ component: Home }]`
        // above `export function Home`) throws a ReferenceError once the
        // function is a const. Such a function is reported but not fixed.
        // Reads inside other functions run later and would be fine, but
        // whether they do is not decidable here, so they count too.
        const isUsedBeforeDeclaration = (node, firstJsxUse) => {
            const start = node.range[FIRST_INDEX];
            const jsxStart = firstJsxUse.get(node.id.name);
            if (jsxStart !== undefined && jsxStart < start) {
                return true;
            }

            let variable = null;
            for (
                let scope =
                    sourceCode.scopeManager?.acquire(node)?.upper ?? null;
                scope && variable === null;
                scope = scope.upper
            ) {
                variable = scope.set.get(node.id.name) ?? null;
            }

            return (
                variable?.references.some((reference) => {
                    return (
                        reference.identifier !== node.id &&
                        reference.identifier.range[FIRST_INDEX] < start
                    );
                }) ?? false
            );
        };

        const reportAll = () => {
            if (candidates.length === NO_ITEMS) {
                return;
            }

            const solidImports = getSolidImportDeclarations(programNode);
            const { firstJsxUse, referencedTypes } = scanProgram(programNode);
            const plans = candidates.map((candidate) => {
                const localTypeName = findLocalTypeName(
                    solidImports,
                    candidate.desiredTypeName,
                );

                return {
                    ...candidate,
                    fixable: !isUsedBeforeDeclaration(
                        candidate.node,
                        firstJsxUse,
                    ),
                    resolvedTypeName:
                        localTypeName === ""
                            ? candidate.desiredTypeName
                            : localTypeName,
                    needsImport: localTypeName === "",
                };
            });

            // The import of every name that a fix writes. Imports in the fix
            // of every component would put one `import` next to each of them
            // (and oxlint drops a fix that overlaps an earlier one), so the
            // first fixable component carries the import for all of them, at
            // the top of the file. A fix that was dropped leaves the others
            // without their import: a type reference to `Component` that the
            // module neither declares nor imports is imported by the next one.
            const fixablePlans = plans.filter((plan) => plan.fixable);
            const [carrier] = fixablePlans;
            const namesToImport = [];
            for (const name of [
                ...fixablePlans
                    .filter((plan) => plan.needsImport)
                    .map((plan) => plan.desiredTypeName),
                ...SOLID_COMPONENT_TYPES.filter((name) => {
                    return (
                        referencedTypes.has(name) &&
                        findLocalTypeName(solidImports, name) === ""
                    );
                }),
            ]) {
                if (!namesToImport.includes(name)) {
                    namesToImport.push(name);
                }
            }

            const importFix = (fixer) => {
                // The names are types: a value import takes them as
                // `type Name`, a type import (without a default or namespace
                // specifier) as `Name`.
                const target = solidImports.find((declaration) => {
                    return canTakeSpecifier(declaration, true);
                });
                if (target) {
                    const typeKeyword =
                        target.importKind === "type" ? "" : "type ";

                    return appendImports(
                        fixer,
                        sourceCode,
                        target,
                        namesToImport.map((name) => `${typeKeyword}${name}`),
                    );
                }

                return insertImports(
                    fixer,
                    sourceCode,
                    SOLID_IMPORT_SOURCE,
                    namesToImport,
                    undefined,
                    true,
                );
            };

            const message =
                "Prefer export const components typed as Component<Props> or ParentComponent<Props>.";
            for (const plan of plans) {
                const { node } = plan;
                if (!plan.fixable) {
                    context.report({ message, node });
                    continue;
                }

                context.report({
                    fix(fixer) {
                        const exportKind = node.parent?.type;
                        const propsSuffix = getPropsSuffix(plan.typeReference);
                        const declaration = `const ${node.id.name}: ${plan.resolvedTypeName}${propsSuffix} = (${plan.propsParam.text}) => ${sourceCode.getText(node.body)};`;
                        let replacement = declaration;
                        let nodeToReplace = node;
                        if (exportKind === "ExportNamedDeclaration") {
                            replacement = `export ${declaration}`;
                            nodeToReplace = node.parent;
                        } else if (exportKind === "ExportDefaultDeclaration") {
                            // `export default const` does not parse.
                            replacement = `${declaration}\nexport default ${node.id.name};`;
                            nodeToReplace = node.parent;
                        }

                        const edits = [
                            fixer.replaceText(nodeToReplace, replacement),
                        ];
                        if (
                            plan === carrier &&
                            namesToImport.length > NO_ITEMS
                        ) {
                            const importEdit = importFix(fixer);
                            if (importEdit) {
                                edits.push(importEdit);
                            }
                        }

                        return edits;
                    },
                    message,
                    node,
                });
            }
        };

        return {
            "Program:exit": reportAll,
            FunctionDeclaration(node) {
                if (!isFunctionComponent(node) || !hasJsxReturn(node.body)) {
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

                candidates.push({
                    desiredTypeName: getDesiredSolidTypeName(usesChildren),
                    node,
                    propsParam,
                    typeReference,
                });
            },
        };
    },
};
