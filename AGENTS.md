## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.

### Available skills
- web-kit-workspace: Use when working across the `web_kit` monorepo, deciding package boundaries, or changing shared workspace standards like Bun, Oxc, TypeScript, or repo-wide scripts. (file: /Users/paulbose/dev_projects/web_kit/.codex/skills/web-kit-workspace/SKILL.md)
- config-package: Use when working in `packages/config`, especially the installer CLI, Oxc/Biome configs, TypeScript templates, and their docs. (file: /Users/paulbose/dev_projects/web_kit/.codex/skills/config-package/SKILL.md)
- typebuddy-package: Use when working in `packages/typebuddy`, including runtime type helpers, `src/types`, custom ESLint rules, and Biome rule experiments. (file: /Users/paulbose/dev_projects/web_kit/.codex/skills/typebuddy-package/SKILL.md)
- simplelog-package: Use when working in `packages/simplelog`, especially the logger runtime, package surface, and Bun-based toolchain. (file: /Users/paulbose/dev_projects/web_kit/.codex/skills/simplelog-package/SKILL.md)

### How to use skills
- Discovery: The list above is the skills available in this repository.
- Trigger rules: If the user names a skill or the task clearly matches a package or workspace area, use the matching skill.
- Keep context small: load only the relevant skill and only load more files when needed.
- If a task is cross-package, start with `web-kit-workspace` and then load the package skill for the touched package.
