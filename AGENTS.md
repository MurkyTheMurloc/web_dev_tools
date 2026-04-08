## Skills

A skill is a set of local instructions stored in a `SKILL.md` file. Load the relevant skill before starting work.

### Available skills

- **web-kit-workspace**: Use when working across the monorepo, deciding package boundaries, or changing shared workspace standards like Bun, Oxc, TypeScript, or repo-wide scripts. (file: /home/game_boy/dev_projects/libs/web_dev_tools/.opencode/skills/web-kit-workspace/SKILL.md)
- **config-package**: Use when working in `packages/config` — the installer CLI, Oxc/Biome configs, TypeScript templates, and their docs. (file: /home/game_boy/dev_projects/libs/web_dev_tools/.opencode/skills/config-package/SKILL.md)
- **typebuddy-package**: Use when working in `packages/typebuddy` — runtime type helpers, `src/types`, custom oxlint rules, and Biome rule experiments. (file: /home/game_boy/dev_projects/libs/web_dev_tools/.opencode/skills/typebuddy-package/SKILL.md)
- **simplelog-package**: Use when working in `packages/simplelog` — the logger runtime, package surface, and Bun-based toolchain. (file: /home/game_boy/dev_projects/libs/web_dev_tools/.opencode/skills/simplelog-package/SKILL.md)
- **oxlint-plugin-solid**: Use when working in `packages/oxlint-plugin-solid` — adding or fixing lint rules, writing tests, or debugging why a Solid rule is not triggering. (file: /home/game_boy/dev_projects/libs/web_dev_tools/.opencode/skills/oxlint-plugin-solid/SKILL.md)

### How to use skills

- Load the skill whose package or domain matches the task before writing any code.
- If the task is cross-package, load `web-kit-workspace` first, then the relevant package skill.
- Keep context small: load only what is needed.
- Skills are the source of truth for package conventions, toolchain choices, and rule authoring patterns.

### Trigger rules

| Task | Load skill |
|---|---|
| Cross-package change, workspace policy | `web-kit-workspace` |
| `packages/config`, installer, Oxc/Biome configs | `config-package` |
| `packages/typebuddy`, type helpers, oxlint rules | `typebuddy-package` |
| `packages/simplelog`, logger runtime | `simplelog-package` |
| `packages/oxlint-plugin-solid`, Solid lint rules | `oxlint-plugin-solid` |
| Solid lint rule not triggering, rule logic bug | `oxlint-plugin-solid` |
