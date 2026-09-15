{pkgs, ...}: let
  # Pin yarn-berry's own Node to the one the shell ships, so the package manager
  # and the runtime never disagree on a version.
  yarn = pkgs.yarn-berry.override {
    nodejs = pkgs.nodejs_24;
  };
in {
  # Node runs the WoW build (tstl); yarn manages packages into node_modules; bun
  # runs the property and fuzz suites.
  packages = [
    pkgs.nodejs_24
    yarn
    pkgs.bun
  ];

  # `languages.javascript.enable` is what registers the yarn install task, so a
  # fresh shell arrives with node_modules already populated. Without it a shell
  # could reach `bun test` with nothing installed and fast-check unresolved.
  #
  # nodeLinker: node-modules and nmMode: hardlinks-global live in .yarnrc.yml:
  # bun reads the real node_modules tree yarn writes, and the hardlink store keeps
  # the install cheap.
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    yarn = {
      enable = true;
      package = pkgs.yarn-berry;
      install.enable = true;
    };
  };
}
