{
  pkgs,
  package,
}:
pkgs.dockerTools.buildLayeredImage {
  name = "jellarr";
  tag = "latest";

  contents = [
    pkgs.coreutils
    pkgs.nodejs_24
    package
  ];

  config = {
    # The binary is the entrypoint, so `docker run … --configFile x` and a
    # Kubernetes `args:` list pass flags to jellarr instead of replacing it.
    Entrypoint = ["${pkgs.lib.getExe package}"];
    Cmd = [];
    Env = ["NODE_ENV=production"];
    # nobody:nogroup; jellarr writes nothing to disk, so it needs no home.
    User = "65534:65534";
  };
}
