# @murky-web/oxlint-plugin-solid

Workspace-Paket fuer den lokalen Oxlint-JS-Plugin-Port der Solid-Regeln.

Es enthaelt die Solid-Regeln lokal im Paket und erweitert den Upstream-Satz um
projektspezifische Regeln wie `solid/prefer-arrow-components`.

Die Regelmodule unter `src/rules/` sind aus dem Upstream-Quellstand abgeleitet
und laufen ohne `eslint-plugin-solid` als Zielprojekt-Dependency.

Aktuell sind enthalten:

- die komplette von `eslint-plugin-solid` exportierte Regelmenge
- die zusaetzliche Projektregel `solid/prefer-arrow-components`
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
