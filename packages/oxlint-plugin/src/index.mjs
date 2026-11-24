import preferStringRawRule from "./rules/prefer_string_raw.mjs";

const plugin = {
    meta: {
        name: "murky"
    },
    rules: {
        "prefer-string-raw": preferStringRawRule
    }
};

// oxlint-disable-next-line import/no-default-export -- Oxlint JS plugins require a default export surface.
export default plugin;
