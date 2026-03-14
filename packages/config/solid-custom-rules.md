# Solid Custom Rules

Eigene projektinterne Solid-Konventionen, die aktuell nicht direkt durch Biome oder `eslint-plugin-solid` abgedeckt sind.

Status:

- Noch keine technische Implementierung
- Erstmal nur gesammelt
- Spaeterer Zielzustand kann sein:
  - dokumentierte Team-Konvention
  - Custom Oxlint JS plugin rule
  - eigener ESLint-kompatibler Solid-Zusatz fuer Oxlint `jsPlugins`

## prefer-arrow-components

Status:

- [ ] Aufnehmen
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
- erleichtert konsistente Typisierung ueber `Component<Props>` oder `ParentComponent<Props>`

Hinweise:

- Das ist aktuell eher eine Team-Konvention als eine vorhandene Standardregel.
- Wenn wir das spaeter technisch erzwingen wollen, muessen wir wahrscheinlich eine eigene Regel bauen.
