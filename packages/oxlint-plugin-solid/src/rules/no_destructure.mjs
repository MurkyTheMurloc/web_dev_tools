import { getStringIfConstant } from "@eslint-community/eslint-utils";

import { getSourceCode } from "../compat.mjs";
import { appendImports, insertImports } from "../utils.mjs";
const SOLID_SOURCE = "solid-js";
const isSolidValueImport = (node) =>
    node.type === "ImportDeclaration" &&
    node.importKind !== "type" &&
    node.source.value === SOLID_SOURCE;
// The specifiers that import `name` by value from "solid-js" (`merge`,
// `merge as solidMerge`, ...).
const findSolidImportSpecifiers = (program, name) => {
    const found = [];
    for (const node of program.body) {
        if (!isSolidValueImport(node)) {
            continue;
        }
        for (const specifier of node.specifiers) {
            if (
                specifier.type === "ImportSpecifier" &&
                specifier.importKind !== "type" &&
                (specifier.imported.name ?? specifier.imported.value) === name
            ) {
                found.push(specifier);
            }
        }
    }
    return found;
};
// The variable `name` resolves to when read from `scope`: the nearest
// binding up the scope chain, or null. Variables for which `ignore` is true
// are skipped, as if they were not there.
const lookupVariable = (scope, name, ignore = () => false) => {
    for (let current = scope; current; current = current.upper) {
        const variable = current.set.get(name);
        if (variable && !ignore(variable)) {
            return variable;
        }
    }
    return null;
};
// `solid` + the name with a capital: `merge` gives `solidMerge`.
const aliasFor = (name, attempt) =>
    `solid${name[0].toUpperCase()}${name.slice(1)}${attempt > 1 ? attempt : ""}`;
const importSpecifierText = ({ imported, local }) =>
    imported === local ? imported : `${imported} as ${local}`;
// The names this rule writes into fixed code: `merge`, `omit` and their
// aliases (`solidMerge`, `solidOmit2`, ...). The `solid-js` import a name
// stands for, as an imported/local pair, or null for any other name.
const GENERATED_NAME = /^(?:(merge|omit)|solid(Merge|Omit)\d*)$/u;
const generatedImport = (name) => {
    const match = GENERATED_NAME.exec(name);
    return match === null
        ? null
        : { imported: (match[1] ?? match[2]).toLowerCase(), local: name };
};
// Whether `call` is a call the fixes of this rule write, with `callee` as its
// callee: `merge({ ... }, _props)`, `omit(props, "a", "b")` or the same with an
// alias (`solidMerge2`). Anything else is somebody else's `merge`/`omit`.
const isGeneratedCall = (call, callee) => {
    if (call?.type !== "CallExpression" || call.callee !== callee) {
        return false;
    }
    const imported = generatedImport(callee.name)?.imported;
    const [first, ...others] = call.arguments;
    if (imported === "merge") {
        return (
            first?.type === "ObjectExpression" &&
            others.length === 1 &&
            others[0].type === "Identifier"
        );
    }
    return (
        imported === "omit" &&
        first?.type === "Identifier" &&
        others.length > 0 &&
        others.every(
            (key) =>
                key.type === "Literal" &&
                (typeof key.value === "string" ||
                    typeof key.value === "number"),
        )
    );
};
const getName = (node) => {
    switch (node.type) {
        case "Literal":
            return typeof node.value === "string" ? node.value : null;
        case "Identifier":
            return node.name;
        case "AssignmentPattern":
            return getName(node.left);
        default:
            return getStringIfConstant(node);
    }
};
// Given ({ 'hello-world': helloWorld = 5 }), returns { real: Literal('hello-world'), var: 'helloWorld', computed: false, init: Literal(5) }
const getPropertyInfo = (prop) => {
    const valueName = getName(prop.value);
    if (valueName !== null) {
        return {
            real: prop.key,
            var: valueName,
            computed: prop.computed,
            init:
                prop.value.type === "AssignmentPattern"
                    ? prop.value.right
                    : undefined,
        };
    } else {
        return null;
    }
};
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow destructuring props. In Solid, props must be used with property accesses (`props.foo`) to preserve reactivity. This rule only tracks destructuring in the parameter list.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-destructure.md",
        },
        fixable: "code",
        schema: [],
        messages: {
            noDestructure:
                "Destructuring component props breaks Solid's reactivity; use property access instead.",
            missingImport:
                "`{{name}}` is used without an import from solid-js.",
            // noWriteToProps: "Component props are readonly, writing to props is not supported.",
        },
    },
    defaultOptions: [],
    create(context) {
        const functionStack = [];
        // Destructuring components found so far, as `{ func, props }`.
        const components = [];
        let sawJSX = false;
        const currentFunction = () => functionStack[functionStack.length - 1];
        const onFunctionEnter = () => {
            functionStack.push({ hasJSX: false });
        };
        const onFunctionExit = (node) => {
            if (node.params.length === 1) {
                const props = node.params[0];
                if (
                    props.type === "ObjectPattern" &&
                    currentFunction().hasJSX &&
                    node.parent?.type !== "JSXExpressionContainer" // "render props" aren't components
                ) {
                    // Props are destructured in the function params, not the body. We actually don't
                    // need to handle the case where props are destructured in the body, because that
                    // will be a violation of "solid/reactivity".
                    // Reported at `Program:exit`, once every component of the
                    // file is known (see `reportAll`).
                    components.push({ func: node, props });
                }
            }
            // Pop on exit
            functionStack.pop();
        };
        // Everything about the rewrite of one component that does not need
        // the fixer: the new parameter, the line for the body, and the
        // `solid-js` names that line calls (`imports`, as imported/local pairs
        // that the file does not import yet).
        const planFix = (func, props) => {
            const propsName = "props";
            const properties = props.properties;
            const propertyInfo = [];
            let rest = null;
            for (const property of properties) {
                if (property.type === "RestElement") {
                    rest = property;
                } else {
                    const info = getPropertyInfo(property);
                    if (info === null) {
                        continue;
                    }
                    propertyInfo.push(info);
                }
            }
            const hasDefaults = propertyInfo.some((info) => info.init);
            const origProps = hasDefaults ? "_" + propsName : propsName;
            const sourceCode = getSourceCode(context);
            const defaultsObjectString = () =>
                propertyInfo
                    .filter((info) => info.init)
                    .map(
                        (info) =>
                            `${info.computed ? "[" : ""}${sourceCode.getText(info.real)}${info.computed ? "]" : ""}: ${sourceCode.getText(info.init)}`,
                    )
                    .join(", ");
            // `omit(props, "a", "b")` takes the keys as varargs, where Solid
            // 1.x `splitProps(props, ["a", "b"])` took an array.
            const omitArgs = () =>
                propertyInfo
                    .map((info) =>
                        info.real.type === "Identifier"
                            ? JSON.stringify(info.real.name)
                            : sourceCode.getText(info.real),
                    )
                    .join(", ");
            const restName = () =>
                (rest.argument.type === "Identifier" && rest.argument.name) ||
                "rest";
            // The name to call `merge`/`omit` by in the body of `func`:
            // the local name of an existing `solid-js` import, otherwise the
            // plain name if nothing else is called that, otherwise a free
            // alias (`solidMerge`, `solidMerge2`, ...). Both of the last two
            // are imported by the carrying fix.
            const program = sourceCode.ast;
            const scopeManager = sourceCode.scopeManager;
            const callScope = scopeManager?.acquire(func) ?? null;
            // The bindings of the destructured props: the fix removes them.
            const removedByFix = (variable) =>
                propertyInfo.some((info) => info.var === variable.name) &&
                variable.defs.every(
                    (def) =>
                        def.name?.range !== undefined &&
                        def.name.range[0] >= props.range[0] &&
                        def.name.range[1] <= props.range[1],
                );
            // A name the import would clash with: a binding in the module
            // scope (import, const, function, class, ...), one on the way from
            // the body of `func` up to it. An unresolved read of the name
            // does not count: it is a dangling call of an earlier fix, which
            // the import settles (see `reportAll`).
            const isTaken = (name) =>
                lookupVariable(callScope, name, removedByFix) !== null ||
                program.body.some(
                    (node) =>
                        node.type === "ImportDeclaration" &&
                        node.specifiers.some(
                            (specifier) => specifier.local.name === name,
                        ),
                );
            const imports = [];
            const solidCallName = (name) => {
                for (const specifier of findSolidImportSpecifiers(
                    program,
                    name,
                )) {
                    const variable = lookupVariable(
                        callScope,
                        specifier.local.name,
                        removedByFix,
                    );
                    // Unless a nearer binding shadows the import here.
                    if (
                        variable === null ||
                        variable.defs.some((def) => def.node === specifier)
                    ) {
                        return specifier.local.name;
                    }
                }
                let local = name;
                for (let attempt = 1; isTaken(local); attempt += 1) {
                    local = aliasFor(name, attempt);
                }
                if (!imports.some((entry) => entry.local === local)) {
                    imports.push({ imported: name, local });
                }
                return local;
            };
            let lineToInsert = "";
            if (hasDefaults && rest) {
                // Merge the defaults, then take the rest off the merged object.
                lineToInsert = `  const ${propsName} = ${solidCallName("merge")}({ ${defaultsObjectString()} }, ${origProps});\n  const ${restName()} = ${solidCallName("omit")}(${propsName}, ${omitArgs()});\n`;
            } else if (hasDefaults) {
                lineToInsert = `  const ${propsName} = ${solidCallName("merge")}({ ${defaultsObjectString()} }, ${origProps});\n`;
            } else if (rest) {
                // `props` already carries the named props; only the rest is new.
                lineToInsert = `  const ${restName()} = ${solidCallName("omit")}(${origProps}, ${omitArgs()});\n`;
            }
            return {
                func,
                props,
                propsName,
                propertyInfo,
                origProps,
                lineToInsert,
                imports,
            };
        };
        // The import edit: the names go into the file's `solid-js` value
        // import, or into a new one if it has none.
        const importFix = (fixer, imports) => {
            const sourceCode = getSourceCode(context);
            const program = sourceCode.ast;
            const names = imports.map(importSpecifierText);
            const declaration = program.body.find(isSolidValueImport);
            return declaration
                ? appendImports(fixer, sourceCode, declaration, names)
                : insertImports(fixer, sourceCode, SOLID_SOURCE, names);
        };
        // `carriedImports` are the names to import, for the one component of
        // the file whose fix also adds the import (see `reportAll`).
        function* fixDestructure(plan, carriedImports, fixer) {
            const {
                func,
                props,
                propsName,
                propertyInfo,
                origProps,
                lineToInsert,
            } = plan;
            const sourceCode = getSourceCode(context);
            // Replace destructured props with a `props` identifier. Only the
            // defaults case needs a second binding (`_props`), because
            // `merge` produces a new object.
            if (props.typeAnnotation) {
                // in `{ prop1, prop2 }: Props`, leave `: Props` alone
                const range = [props.range[0], props.typeAnnotation.range[0]];
                yield fixer.replaceTextRange(range, origProps);
            } else {
                yield fixer.replaceText(props, origProps);
            }
            if (carriedImports.length > 0) {
                const fix = importFix(fixer, carriedImports);
                if (fix) {
                    yield fix;
                }
            }
            if (lineToInsert) {
                const body = func.body;
                if (body.type === "BlockStatement") {
                    if (body.body.length > 0) {
                        // Inject lines handling defaults/rest params before the first statement in the block.
                        yield fixer.insertTextBefore(
                            body.body[0],
                            lineToInsert,
                        );
                    }
                    // with an empty block statement body, no need to inject code
                } else {
                    // The function is an arrow function that implicitly returns an expression, possibly with wrapping parentheses.
                    // These must be removed to convert the function body to a block statement for code injection.
                    const maybeOpenParen = sourceCode.getTokenBefore(body);
                    if (maybeOpenParen?.value === "(") {
                        yield fixer.remove(maybeOpenParen);
                    }
                    const maybeCloseParen = sourceCode.getTokenAfter(body);
                    if (maybeCloseParen?.value === ")") {
                        yield fixer.remove(maybeCloseParen);
                    }
                    // Inject lines handling defaults/rest params
                    yield fixer.insertTextBefore(
                        body,
                        `{\n${lineToInsert}  return (`,
                    );
                    yield fixer.insertTextAfter(body, `);\n}`);
                }
            }
            const scope = sourceCode.scopeManager?.acquire(func);
            if (scope) {
                // iterate through destructured variables, associated with real node
                for (const [info, variable] of propertyInfo.map((info) => [
                    info,
                    scope.set.get(info.var),
                ])) {
                    if (variable) {
                        // replace all usages of the variable with props accesses
                        for (const reference of variable.references) {
                            if (reference.isReadOnly()) {
                                const access =
                                    info.real.type === "Identifier" &&
                                    !info.computed
                                        ? `.${info.real.name}`
                                        : `[${sourceCode.getText(info.real)}]`;
                                yield fixer.replaceText(
                                    reference.identifier,
                                    `${propsName}${access}`,
                                );
                            }
                        }
                    }
                }
            }
        }
        // oxlint merges the edits of one fix into a single replacement that
        // runs from its first to its last edit, and skips a fix that overlaps
        // one it already applied (a run is one pass). An import edit at the
        // top of the file in every component's fix would make all of them
        // overlap, so one run would fix one component. Instead the fix of the
        // first component in the file (the carrier) holds the import, for the
        // names of all components; the others only rewrite themselves. Every
        // fix then starts after the end of the one before.
        //
        // The catch: if the carrier's fix is dropped (another rule's fix
        // overlaps it), the others call names that are not imported yet. A
        // later run heals that: calls of `merge`, `omit` and their aliases in
        // the shape this rule writes, that no binding resolves ("dangling"),
        // get their own report, whose fix only adds those names. The carrier
        // leaves the dangling names out. Its import edit and that fix start
        // at the same position, so when both are in one run oxlint applies
        // the missingImport fix and drops the carrier's fix; the next run
        // appends the carrier's names to the import. Every run then makes
        // progress and the file ends with valid code.
        const reportAll = () => {
            const sourceCode = getSourceCode(context);
            const plans = [...components]
                .sort((a, b) => a.props.range[0] - b.props.range[0])
                .map(({ func, props }) => planFix(func, props));
            // Only in a Solid file: JSX or an import from solid-js. Any other
            // module may call its own global `merge`.
            const isSolidFile =
                sawJSX ||
                sourceCode.ast.body.some(
                    (node) =>
                        node.type === "ImportDeclaration" &&
                        node.source.value === SOLID_SOURCE,
                );
            const callees = (
                sourceCode.scopeManager?.globalScope?.through ?? []
            )
                .filter(
                    ({ identifier }) =>
                        isSolidFile &&
                        isGeneratedCall(identifier.parent, identifier),
                )
                .sort((a, b) => a.identifier.range[0] - b.identifier.range[0]);
            const danglingImports = [];
            const plannedImports = [];
            const addImport = (list, entry) => {
                if (!list.some((known) => known.local === entry.local)) {
                    list.push(entry);
                }
            };
            callees.forEach(({ identifier }) =>
                addImport(danglingImports, generatedImport(identifier.name)),
            );
            plans.forEach((plan) =>
                plan.imports
                    .filter(
                        (entry) =>
                            !danglingImports.some(
                                (known) => known.local === entry.local,
                            ),
                    )
                    .forEach((entry) => addImport(plannedImports, entry)),
            );
            if (callees.length > 0) {
                const [{ identifier }] = callees;
                context.report({
                    node: identifier,
                    messageId: "missingImport",
                    data: { name: identifier.name },
                    fix: (fixer) => importFix(fixer, danglingImports),
                });
            }
            plans.forEach((plan, index) => {
                context.report({
                    node: plan.props,
                    messageId: "noDestructure",
                    fix: (fixer) =>
                        fixDestructure(
                            plan,
                            index === 0 ? plannedImports : [],
                            fixer,
                        ),
                });
            });
        };
        return {
            "Program:exit": reportAll,
            FunctionDeclaration: onFunctionEnter,
            FunctionExpression: onFunctionEnter,
            ArrowFunctionExpression: onFunctionEnter,
            "FunctionDeclaration:exit": onFunctionExit,
            "FunctionExpression:exit": onFunctionExit,
            "ArrowFunctionExpression:exit": onFunctionExit,
            JSXElement() {
                sawJSX = true;
                if (functionStack.length) {
                    currentFunction().hasJSX = true;
                }
            },
            JSXFragment() {
                sawJSX = true;
                if (functionStack.length) {
                    currentFunction().hasJSX = true;
                }
            },
        };
    },
};
