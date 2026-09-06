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
  je wieder ab)
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
