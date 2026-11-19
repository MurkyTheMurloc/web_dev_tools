# Bun, Node and the project tools for web_dev_tools. oxlint, oxfmt, vitest, tsdown and
# changesets come from package.json (node_modules/.bin); this file only provides the
# runtimes. CI reads the Bun version from package.json `packageManager`: keep it equal to
# the Bun in this shell.
{ pkgs, ... }:

{
  # act runs the GitHub workflows locally in Docker (see scripts.ci-local).
  packages = [
    pkgs.jq
    pkgs.act
  ];

  # The pull-request workflows (ci.yml, publish-dry-run.yml) as GitHub runs them,
  # CI=true included. `ci-local -j typebuddy` runs one job. What the agents' Docker
  # socket refuses is switched off, and no job needs it: the Docker socket in the job
  # container, host networking (bridge instead), and the actions cache server (it
  # binds to the host's outbound IP).
  scripts.ci-local = {
    description = "Run the pull-request workflows locally with act";
    exec = ''
      act pull_request \
        -P ubuntu-latest=catthehacker/ubuntu:act-latest \
        --container-daemon-socket=- \
        --network bridge \
        --no-cache-server \
        "$@"
    '';
  };

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
