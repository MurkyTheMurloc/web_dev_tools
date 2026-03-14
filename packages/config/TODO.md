# TODO

## Agent Skills

- Skill-Template-Struktur fuer dieses Repo definieren
- zwischen projektlokalen Skills und globalen Codex-Skills unterscheiden
- CLI um einen Skill-Install-Flow erweitern
- Skill-Install-Flags entwerfen, analog zu `--oxc`, `--biome`, `--typescript`
- Stack-Presets mit Skills koppeln, z. B. `--frontend-solid`
- README um den Skill-Workflow erweitern

## TypeScript

- TypeScript-Templates in die CLI integrieren ist erledigt, aber echte Install-Laeufe ohne `--skip-install` noch einmal testen
- Bun- und Deno-spezifische Templates spaeter getrennt vorbereiten
- Template-`tsconfig`s von Generatoren wie Vite vor dem Loeschen gezielt analysieren und notwendige projektspezifische Optionen bewusst in unsere Presets uebernehmen
- fuer unterstuetzte Templates klare Adaptionen definieren, statt spaeter hybride Mischzustaende zu behalten

## Solid

- Biome-Solid und Oxc-Solid noch einmal gemeinsam glätten
- echten Install-Lauf mit `eslint-plugin-solid` und Oxlint pruefen
- spaeter entscheiden, ob eigene Solid-Custom-Rules technisch umgesetzt werden
