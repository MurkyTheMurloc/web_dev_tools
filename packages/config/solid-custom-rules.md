# Solid Custom Rules

Eigene projektinterne Solid-Konventionen, die aktuell nicht direkt durch Biome
oder das nackte `eslint-plugin-solid` abgedeckt sind.

Status:

- Technisch ueber die lokale Solid-Oxlint-Erweiterung umgesetzt
- Aktivierbar ueber `--frontend-solid`
- Das Preset aktiviert jetzt die komplette von `eslint-plugin-solid` exportierte
  Upstream-Regelmenge
- Laeuft unter dem `solid/*`-Namespace

Hinweis:

- Im Upstream-Repo liegt zusaetzlich noch `validate-jsx-nesting` im
  `src/rules`-Ordner.
- Die Regel ist dort aktuell aber in `src/plugin.ts` auskommentiert und wird vom
  veroeffentlichten Plugin nicht exportiert.
- Im lokalen Port existiert sie deshalb als Placeholder-Regel mit leerer
  Implementierung, damit die komplette Upstream-Rule-Surface im Paket vorhanden
  ist.

## prefer-arrow-components

Status:

- [x] Aufnehmen
- [ ] Ablehnen

Kurz:

- Solid-Komponenten immer als `const`-Arrow-Component schreiben
- keine `function SomeComponent(...) {}`-Deklarationen fuer Components

Gewuenscht:

```tsx
import type { Component, ParentComponent } from "solid-js";

const SomeComponent: Component<Props> = (props) => {
    return <div>{props.name}</div>;
};

const SomeParent: ParentComponent<Props> = (props) => {
    return <section>{props.children}</section>;
};
```

Nicht gewuenscht:

```tsx
function SomeComponent(props: Props) {
    return <div>{props.name}</div>;
}
```

Warum:

- einheitlicher Komponentenstil
- sofort als Component-Konstante erkennbar
- passt zu deinem bevorzugten Solid-Stil
- erleichtert konsistente Typisierung ueber `Component<Props>` oder
  `ParentComponent<Props>`

Hinweise:

- Die Regel ist jetzt im Workspace-Paket `@murky-web/oxlint-plugin-solid`
  umgesetzt.
- `@murky-web/config` bindet dieses Paket als Dependency ein und kopiert die
  Runtime beim `--frontend-solid`-Install in das Zielprojekt.
- Sie ergaenzt die Upstream-Solid-Regeln unter demselben `solid/*`-Namespace.
- Das Solid-Preset schaltet fuer `*.tsx` und `*.jsx` bewusst
  `prefer-readonly-parameter-types` ab, weil die gewollte
  `Component<Props>`-/`ParentComponent<Props>`-Signatur sonst direkt wieder vom
  allgemeinen TypeScript-Regelset verworfen wuerde.
