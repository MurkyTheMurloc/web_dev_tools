// An object literal passed to `merge` loses its types: TypeScript widens
// `{ variant: "primary" }` to `string`, and annotating the defaults as
// `Partial<Props>` makes every defaulted prop optional again. Writing the
// literal with `satisfies Partial<Props>` keeps the literal types and checks
// the keys against the props; `as const` keeps the literal types too.
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
                'Type this object literal passed to `{{name}}` with `satisfies Partial<Props>`: a plain literal widens `"primary"` to `string`, and `as Partial<Props>` or a `Partial<Props>` variable makes the defaulted props optional again. Example: `merge({ size: 1 } satisfies Partial<Props>, props)`.'
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
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
                        context.report({
                            data: { name: node.callee.name },
                            messageId: "untypedDefaults",
                            node: argument
                        });
                    }
                }
            }
        };
    }
};
