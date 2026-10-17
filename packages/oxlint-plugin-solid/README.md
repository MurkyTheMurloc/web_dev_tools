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

- die komplette von `eslint-plugin-solid` exportierte Regelmenge
- die zusaetzlichen Projektregeln `solid/prefer-arrow-components`,
  `solid/no-setter-in-effect` (meldet Effects, die nur in ein Signal oder einen
  Store schreiben, statt den Wert abzuleiten -- und Effects, die etwas awaiten
  und das Ergebnis zurueckschreiben, statt es aus einer Derivation zu liefern)
  `solid/no-untracked-effect-read` (meldet reaktive Reads in der
  apply-Phase eines zweiphasigen `createEffect`, die dort nicht tracken) und
  `solid/no-owned-primitives-in-ref` (meldet `createEffect`/`onCleanup` und
  Verwandte in einem Ref-Callback -- der laeuft ohne Owner, nichts raeumt sie
  je wieder ab),
  `solid/reactive-async`, `solid/no-server-import-in-client` und
  `solid/strict-void-return` (siehe unten)
- ein Test-Harness, der die exportierte Rule-Surface und echte Diagnostik
  gegen Temp-Projekte prueft

Aktuell wird das Paket nicht direkt im Zielprojekt installiert. Stattdessen
kopiert `@murky-web/config` die Rule-Runtime in `./oxc/jsplugins/solid/`, damit
Oxlint sie ueber einen lokalen `jsPlugins`-Pfad laden kann.

Wichtig dabei:

- `@murky-web/config` loest dieses Paket als normale Workspace-Dependency auf
- der Installer kopiert den lokalen Plugin-Src-Ordner aus der installierten
  Paketauflösung
- Zielprojekte brauchen dadurch weiter nur die kopierte Runtime unter
  `./oxc/jsplugins/solid/`, nicht dieses Paket als direkte Dependency

## Regeln fuer das Solid-2.0-Modell

Die drei Regeln arbeiten ohne Typinformation, nur mit Syntax und Scope. Sie
sind in `config/oxc/linting/solid.jsonc` aktiv und ersetzen dort fuer
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
- ein `async`-Callback, dessen einziges `await` ein `return await x` ist: `async`
  und `await` weglassen und das Promise zurueckgeben. Innerhalb von `try` bleibt
  `return await` erlaubt, weil es das `catch` erst moeglich macht.

Grenzen: Reads in verschachtelten Funktionen, Helfern und `.then`-Callbacks
sieht die Regel nicht (die Laufzeit-Diagnose schon). Ob ein Name ein Signal ist,
folgt nur aus `createSignal`/`createMemo`/den Store-Primitiven in derselben
Datei und aus dem Namen `props`.

### `solid/no-server-import-in-client`

Client-Dateien (`.tsx` und `.ts` ausserhalb von `src/server/`, ohne
Test-Dateien) duerfen ein Modul unter `src/server/` nur importieren, wenn dessen
erste Anweisung `"use server"` ist. Der Pfad wird vom importierenden File aus
aufgeloest (relativ oder `~/` = `<Projekt>/src/`, Projektwurzel = naechstes
Verzeichnis mit `package.json`) und die Zieldatei gelesen. Fehlt das Ziel,
wird nichts gemeldet. `import type` wird ignoriert. Geprueft werden auch
`export ... from` und `import("...")` mit String-Literal.

Grenze: andere Aliase und Server-Code ausserhalb von `src/server/` kennt die
Regel nicht.

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

## Nutzung ueber @murky-web/config

Im Zielprojekt:

```bash
web-dev-config init --oxc --typescript --frontend-solid
```

Danach:

- liegt die lokale Rule-Runtime unter `./oxc/jsplugins/solid/`
- wird `./linting/solid.jsonc` in die Oxc-Konfiguration eingehängt
- zeigt `jsPlugins` auf `./jsplugins/solid/index.mjs`
- feuern sowohl die portierten Solid-Regeln als auch
  `solid/prefer-arrow-components`

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
