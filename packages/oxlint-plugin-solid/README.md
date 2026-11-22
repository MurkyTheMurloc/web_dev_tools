# @murky-web/oxlint-plugin-solid

Workspace-Paket fuer den lokalen Oxlint-JS-Plugin-Port der Solid-Regeln.

Es enthaelt die Solid-Regeln lokal im Paket und erweitert den Upstream-Satz um
projektspezifische Regeln wie `solid/prefer-arrow-components`.

Die Regelmodule unter `src/rules/` sind aus dem Upstream-Quellstand abgeleitet
und laufen ohne `eslint-plugin-solid` als Zielprojekt-Dependency.

Das Paket zieht auch ESLint selbst nicht mehr nach. Die Regeln sind schlichte
Objekte, wie Oxlint sie erwartet -- der `createRule`-Wrapper aus
`@typescript-eslint/utils` war nur eine TypeScript-Typhilfe und ist entfallen.
Geblieben sind fuenf AST-Helfer, die jetzt direkt aus
`@eslint-community/eslint-utils` kommen, statt die komplette
TypeScript-ESLint-Toolchain in den Baum jedes Konsumenten zu ziehen.

Aktuell sind enthalten:

- die Regeln von `eslint-plugin-solid` 0.14.5; was Upstream bis 0.20.1
  dazugebaut hat, fehlt teils (`bun upstream/run.mjs` zeigt den Abgleich)
- die zusaetzlichen Projektregeln `solid/prefer-arrow-components`,
  `solid/no-setter-in-effect` (meldet Effects, die nur in ein Signal oder einen
  Store schreiben, statt den Wert abzuleiten -- und Effects, die etwas awaiten
  und das Ergebnis zurueckschreiben, statt es aus einer Derivation zu liefern)
  `solid/no-untracked-effect-read` (meldet reaktive Reads in der apply-Phase
  eines zweiphasigen `createEffect`, die dort nicht tracken) und
  `solid/no-owned-primitives-in-ref` (meldet `createEffect`/`onCleanup` und
  Verwandte in einem Ref-Callback -- der laeuft ohne Owner, nichts raeumt sie je
  wieder ab), `solid/reactive-async`, `solid/no-server-import-in-client` und
  `solid/strict-void-return` (siehe unten)
- `solid/no-module-scope-reactive-primitive` aus eslint-plugin-solid 0.20.1
  (meldet `createSignal`, `createStore` und Verwandte auf Modul-Ebene: beim SSR
  teilen sich alle Requests diesen Zustand) und
  `solid/no-write-in-pure-computation` (meldet Setter in `createMemo`, in der
  Compute-Phase von `createEffect` und im Component-Body)
- ein Test-Harness, der die exportierte Rule-Surface und echte Diagnostik gegen
  Temp-Projekte prueft

Das Paket wird als normale Dependency installiert und in der
Oxlint-Konfiguration als JS-Plugin geladen:

```jsonc
{
    "jsPlugins": ["@murky-web/oxlint-plugin-solid"],
    "rules": {
        "solid/reactivity": "error",
        "solid/prefer-arrow-components": "error"
    }
}
```

Die Regeln heissen `solid/<name>`. Welche Regeln dieses Repo selbst einschaltet,
steht in `packages/oxc-config/linting/solid.jsonc`.

## Regeln fuer das Solid-2.0-Modell

Die drei Regeln arbeiten ohne Typinformation, nur mit Syntax und Scope. Sie sind
in `packages/oxc-config/linting/solid.jsonc` aktiv und ersetzen dort fuer
`*.tsx`/`*.jsx` die Typ-Regeln `typescript/promise-function-async` und
`typescript/strict-void-return`.

### `solid/reactive-async`

In einer reaktiven Berechnung liest Solid ein zurueckgegebenes Promise wie einen
Wert; `createMemo(() => getProduct(props.id))` braucht kein `async`. Geprueft
werden die Callbacks von `createMemo`, `createSignal(fn)`, `createStore(fn)`,
`createProjection`, `createOptimistic`, `createOptimisticStore` und die
Compute-Phase des zweiphasigen `createEffect`/`createRenderEffect`.

Gemeldet wird

- ein Read nach dem ersten `await` im selben Callback (Aufruf eines Signals oder
  Memos, `props.x`, Property-Read eines Stores): Solid meldet das zur Laufzeit
  als `UNTRACKED_READ_AFTER_AWAIT`, es wird nie eine Dependency. Lies den Wert
  vor dem `await` in eine lokale Variable.
- ein `async`-Callback, dessen einziges `await` ein `return await x` ist:
  `async` und `await` weglassen und das Promise zurueckgeben. Innerhalb von
  `try` bleibt `return await` erlaubt, weil es das `catch` erst moeglich macht.

Grenzen: Reads in verschachtelten Funktionen, Helfern und `.then`-Callbacks
sieht die Regel nicht (die Laufzeit-Diagnose schon). Ob ein Name ein Signal ist,
folgt nur aus `createSignal`/`createMemo`/den Store-Primitiven in derselben
Datei und aus dem Namen `props`.

### `solid/no-server-import-in-client`

Client-Dateien (`.tsx` und `.ts` ausserhalb von `src/server/`, ohne
Test-Dateien) duerfen ein Modul unter `src/server/` nur importieren, wenn es die
Direktive `"use server"` hat. Der Pfad wird vom importierenden File aus
aufgeloest (relativ oder `~/` = `<Projekt>/src/`) und die Zieldatei gelesen.
Projektwurzel ist das naechste Verzeichnis ueber der Datei, das `src/server`
enthaelt (nicht das naechste `package.json`: das kann in jedem Unterordner
liegen). Die Suche nach oben endet beim ersten Verzeichnis mit `.git` oder mit
einer `package.json` mit `workspaces`; ein `src/server` weiter oben (etwa im
Home-Verzeichnis) gehoert zu etwas anderem. Ohne ein solches Verzeichnis meldet
die Regel nichts. Das Ergebnis wird pro Verzeichnis fuer die Laufzeit des
Prozesses gemerkt: ein `src/server`, das ein laufender Language Server erst
spaeter sieht, wird nach einem Neustart gefunden. Fehlt das Ziel, wird nichts
gemeldet. `import type` wird ignoriert. Geprueft werden auch `export ... from`,
`import("...")` und `require("...")`, jeweils mit String- oder Template-Literal
ohne Platzhalter.

Die Direktive muss im Direktiven-Prolog stehen, also unter den
String-Anweisungen am Dateianfang (`"use strict"; "use server";` zaehlt).
Kommentare davor sind erlaubt, ein Ausdruck wie `"use server".length;` oder
`("use server");` und ein Escape wie `"use\x20server"` nicht. Ein Zeilenumbruch
ohne Semikolon beendet die Anweisung nur dort, wo auch JavaScript ein Semikolon
einfuegt (eine Folgezeile mit `.`, `(`, `[`, einem Operator oder einem
Template-Literal gehoert noch zum String).

Grenzen: andere Aliase als `~/` und Server-Code ausserhalb von `src/server/`
kennt die Regel nicht, ein `require`, das lokal neu definiert ist, wird trotzdem
geprueft, und `package.json`-`exports`/`paths` werden nicht gelesen.

### `solid/strict-void-return`

Ohne Typen meldet sie Funktionen, deren Rueckgabewert Solid verwirft:

- ein Arrow mit Expression-Body (nicht `void x`) in einem `on*`-Attribut,
  `on:event` oder in `ref` (auch in einem Ref-Array). Erlaubt sind Block-Body
  und ein direkt uebergebener Setter (`ref={setInput}`).
- ein `onCleanup`-Callback, der einen sicher nicht-void Wert zurueckgibt
  (Literal, Zuweisung, Objekt, ...). Ein Call wie `() => clearInterval(id)`
  bleibt erlaubt.
- ein `onSettled`-Callback, der etwas anderes als eine Cleanup-Funktion
  zurueckgibt (Literal, Zuweisung, ...).

Die Regel ist schwaecher als `typescript/strict-void-return`: sie sieht nur
Inline-Callbacks, keine Funktionen, die per Namen uebergeben werden, und bei
`onCleanup`/`onSettled` keine Calls, deren Rueckgabetyp sie nicht kennt.

### `solid/validate-jsx-nesting`

Meldet HTML-Verschachtelung, die der Browser umbaut, so dass das gerenderte DOM
nicht dem JSX entspricht: `<p><div /></p>`, ein Link im Link, ein Button im
Button, `<tr>` direkt in `<table>` (der Parser setzt ein `<tbody>` dazwischen),
`<td>` ausserhalb einer Zeile, ein `<div>` im `<svg>` und aehnliches. Der
Elternknoten wird durch Fragmente, Expression-Container, Arrays und `&&`/`?:`
hindurch gesucht; ein Kind, das erst durch einen Ausdruck (`{cond && <div />}`)
in den Elternknoten kommt, bekommt die Meldung fuer Hydration (der Client baut
es wie geschrieben, nur der vom Server gerenderte HTML-Text wird umgebaut).

Die Regel ist die aus `eslint-plugin-solid` 0.20 (MIT, Josh Wilson) und arbeitet
wie dort in zwei Schritten: `validate-html-nesting` (ISC) sagt, ob ein Paar nach
der HTML-Spezifikation gueltig ist, und parse5 -- der Parser, den auch Solids
Compiler fuer Templates nutzt -- entscheidet, ob er das Kind wirklich anders
einsortiert. Nur dann gibt es eine Meldung; Markup, das die Spezifikation
verbietet, der Parser aber so laesst (`<div><figcaption /></div>`,
`<h1><div /></h1>`), wird nicht gemeldet. Der Inhalt von `<svg>` und `<math>`
wird in dem Namensraum geprueft, den der Parser dort hat
(`<svg><a><a /></a></svg>` bleibt erlaubt, unter `<foreignObject>` oder `<p>`
gilt wieder HTML). Abweichung von Upstream: ein `<input type="hidden">` in einer
Tabelle wird nicht gemeldet, der Parser laesst es dort stehen. Grenzen: ein
Elternknoten, der kein DOM-Element ist (`<Show>`, eine Komponente, ein
`.map()`-Callback), wird nicht durchschaut.

## Autofixes

`oxlint --fix` schreibt nur Code, der danach noch dasselbe tut. Wo ein Umbau das
nicht sicher kann, bleibt es bei der Meldung ohne Fix:

- `solid/prefer-arrow-components`: eine Funktion, die vor ihrer Deklaration
  gelesen wird (`export const routes = [{ component: Home }]` vor
  `export function Home`), wird nicht umgeschrieben, weil die `const` dort noch
  nicht initialisiert waere (ReferenceError). Zaehlt jede Stelle vor der
  Deklaration, auch in einer Funktion, weil das Plugin nicht weiss, wann sie
  laeuft. `export default function Page` wird zu `const Page ... ;` plus
  `export default Page;`. Der `solid-js`-Typ-Import steht einmal oben in der
  Datei, nach einer `"use client"`-Direktive.
- `solid/no-destructure`: ein verschachteltes Muster (`{ user: { name } }`), ein
  berechneter Schluessel, der kein Literal ist (`{ [key]: label }`), eine
  Zuweisung an einen destrukturierten Namen und ein Default, der einen frueheren
  Prop liest, werden nur gemeldet. Der neue Parameter heisst `props`, oder
  `props2`, `props3`, ... wenn der Name in einem umgebenden Scope schon vergeben
  ist (sonst faengt er die Reads des aeusseren `props` ab). Ein Shorthand
  (`{ title }`) wird zu `{ title: props.title }`.
- `solid/imports`: ein Wert wird nie in ein `import type` verschoben, ein Typ
  kommt in einem Wert-Import als `type Name` an und in einem `import type` ohne
  `type`; passt keine vorhandene Deklaration, schreibt der Fix eine neue.
- `solid/prefer-class-object`: steht neben `classList` schon ein `class`, wird
  nur gemeldet (der Fix haette `class` doppelt geschrieben).

Ein typischer Fix-Fall:

```tsx
export function Card(props: Props) {
    return <section>{props.children}</section>;
}
```

wird mit `oxlint --fix` zu:

```tsx
import type { ParentComponent } from "solid-js";

export const Card: ParentComponent<Props> = (props) => {
    return <section>{props.children}</section>;
};
```
