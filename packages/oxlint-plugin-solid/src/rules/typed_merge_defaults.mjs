// An object literal passed to `merge` loses its types: TypeScript widens
// `{ variant: "primary" }` to `string`, and annotating the defaults as
// `Partial<Props>` makes every defaulted prop optional again. Writing the
// literal with `satisfies Partial<Props>` keeps the literal types and checks
// the keys against the props; `as const` keeps the literal types too.
import { getSourceCode } from "../compat.mjs";
import { trackImports } from "../utils.mjs";

function isAsConst(node) {
    return (
        node.type === "TSAsExpression" &&
        node.typeAnnotation.type === "TSTypeReference" &&
        node.typeAnnotation.typeName.type === "Identifier" &&
        node.typeAnnotation.typeName.name === "const"
    );
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Require `satisfies Partial<Props>` (or `as const`) on object literals passed to `merge`, so the defaults keep their types."
        },
        schema: [],
        messages: {
            untypedDefaults:
                'The defaults `{{object}}` passed to `{{name}}` have no checked type, so their literals widen (`"primary"` becomes `string`) and their keys are not checked against the props. Fix: `{{object}} satisfies {{type}}`{{where}}. Do not: write `as Partial<Props>` or use a `Partial<Props>` variable; both make the defaulted props optional again.'
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const sourceCode = getSourceCode(context);
        // A one-line literal is quoted as written; a longer one is elided.
        const quote = (node) => {
            const text = sourceCode.getText(node);
            return text.includes("\n") ? "{ … }" : text;
        };
        return {
            ImportDeclaration: handleImportDeclaration,
            CallExpression(node) {
                if (node.callee.type !== "Identifier") {
                    return;
                }
                // `@solidjs/web` re-exports `merge` as `mergeProps`.
                const name = matchImport(
                    ["merge", "mergeProps"],
                    node.callee.name
                );
                if (!name) {
                    return;
                }
                for (const argument of node.arguments) {
                    const untyped =
                        argument.type === "ObjectExpression" ||
                        (argument.type === "TSAsExpression" &&
                            !isAsConst(argument) &&
                            argument.expression.type === "ObjectExpression");
                    if (untyped) {
                        const literal =
                            argument.type === "TSAsExpression"
                                ? argument.expression
                                : argument;
                        const asType =
                            argument.type === "TSAsExpression"
                                ? sourceCode.getText(argument.typeAnnotation)
                                : null;
                        context.report({
                            data: {
                                name: node.callee.name,
                                object: quote(literal),
                                // `{ … } as Partial<ButtonProps>` names the type.
                                type: asType ?? "Partial<Props>",
                                where:
                                    asType === null
                                        ? ", with `Props` the props type of the component"
                                        : ""
                            },
                            messageId: "untypedDefaults",
                            node: argument
                        });
                    }
                }
            }
        };
    }
};
