# @murky-web/oxlint-plugin

Basis-Plugin fuer Oxlint (JS-Plugin, Praefix `murky`) mit allgemeinen
JavaScript-Regeln und gemeinsamen AST-Helfern.

## Plugin-Familie

- `@murky-web/oxlint-plugin` (dieses Paket): Regeln, die fuer jedes JavaScript
  gelten, und die Helfer unter `@murky-web/oxlint-plugin/utils`.
- `@murky-web/oxlint-plugin-typescript` (geplant): Regeln, die TypeScript
  brauchen.
- `@murky-web/oxlint-plugin-solid`: Regeln fuer Solid.
- `@murky-web/oxlint-plugin-hono`: Regeln fuer Hono.

Die spezialisierten Plugins koennen dieses Paket als Dependency nehmen und die
Helfer aus `./utils` nutzen: `sourceCodeOf(context)`, `runsAtModuleLoad(node)`
und `isGlobalReference(sourceCode, identifier)`.

## Einbinden

```jsonc
{
    "jsPlugins": ["@murky-web/oxlint-plugin"],
    "rules": {
        "murky/prefer-string-raw": "error"
    }
}
```

`@murky-web/oxc-config` schaltet die Regeln in `linting/murky.jsonc` ein.

## Regeln

### `murky/prefer-string-raw`

Fork von unicorns `prefer-string-raw` in der Fassung von oxlint. Gemeldet wird
dasselbe: ein String-Literal, das nur Backslashes escaped (`"a\\b"`), wird zu
`` String.raw`a\b` ``, mit Autofix. Ausgenommen bleiben wie im Original
Direktiven, Modul-Specifier, nicht berechnete Property-Keys, Literal-Typen,
JSX-Attribute, Enum-Member, Literale mit anderen Escapes, mit Backtick, mit `${`
oder mit einem einzelnen Backslash am Ende, sowie `.d.ts`-Dateien. Zusaetzlich
ausgenommen sind Keys von Klassen-Membern und Import-Attribute, wo ein Template
ebenfalls nicht erlaubt ist.

Neu: Es kommt darauf an, wann der Code laeuft. `String.raw` ist ein Tagged
Template, also ein Funktionsaufruf. Laeuft er beim Laden des Moduls, kann ein
Bundler nicht beweisen, dass er pur ist, und behaelt ihn in jedem Client-Chunk,
der das Modul importiert, auch wenn der Wert ungenutzt bleibt. Deshalb:

- Ein String-Literal, das beim Laden des Moduls ausgewertet wird, ist erlaubt:
  `const ESCAPES = new Map([["<", "\\u003c"]]);` bleibt so.
- `String.raw`, das beim Laden des Moduls ausgewertet wird, wird gemeldet; der
  Autofix schreibt das Literal (`` String.raw`<` `` -> `"\\u003c"`, mit
  Ausdruecken ein Template-Literal mit escapten Backslashes).
- In einer Funktion gilt die Regel wie unicorns.

"Beim Laden des Moduls" heisst: ausserhalb jedes Funktionsrumpfs. Klassenrumpf,
berechnete Keys, statische Felder und `static`-Bloecke zaehlen dazu;
Initialisierer von Instanzfeldern laufen erst bei `new` und zaehlen wie eine
Funktion. Eine IIFE zaehlt als Funktion.
