// dist/type_helper.js
function isString(value) {
  return typeof value === "string";
}

// smoke/treeshake/entry.ts
var candidate = "hello";
if (isString(candidate)) {
  console.log(candidate.toUpperCase());
}
