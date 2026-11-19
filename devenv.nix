# Bun, Node and the project tools for web_dev_tools. oxlint, oxfmt, vitest, tsdown and
# changesets come from package.json (node_modules/.bin); this file only provides the
# runtimes. CI reads the Bun version from package.json `packageManager`: keep it equal to
# the Bun in this shell.
{ pkgs, ... }:

{
  packages = [ pkgs.jq ];

  # Node 24 as in the publish workflow (vitest 5 and changesets 3 need >= 22.12).
  # bun install runs by itself when bun.lock changed; devenv keeps a checksum of the lock
  # in node_modules, so an unchanged lock costs nothing.
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    bun.enable = true;
    bun.install.enable = true;
    # Its default pulls typescript-language-server from nixpkgs; the editor brings its own
    lsp.enable = false;
  };

  # Project tools win over anything on the system PATH. Bun's package cache lives under
  # the repo's .git, shared by every worktree (agents in the sandbox may write there,
  # never into ~).
  enterShell = ''
    export BUN_INSTALL_CACHE_DIR="$(git -C "$DEVENV_ROOT" rev-parse --path-format=absolute --git-common-dir)/devenv-cache/bun"
    export PATH="$DEVENV_ROOT/node_modules/.bin:$PATH"
  '';
}
