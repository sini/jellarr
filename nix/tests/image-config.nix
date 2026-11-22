{
  pkgs,
  image,
  package,
}:
# The image must run jellarr as its entrypoint, as a non-root user, so a
# Kubernetes `args:` list or `docker run … --flag` reaches jellarr.
pkgs.runCommand "jellarr-image-config" {nativeBuildInputs = [pkgs.jq pkgs.gnutar];} ''
  tar -xzf ${image} manifest.json
  config="$(jq -r '.[0].Config' manifest.json)"
  tar -xzf ${image} "$config"

  entrypoint="$(jq -r '.config.Entrypoint[0] // empty' "$config")"
  [ "$entrypoint" = "${pkgs.lib.getExe package}" ] \
    || { echo "Entrypoint is '$entrypoint', expected ${pkgs.lib.getExe package}"; exit 1; }
  [ "$(jq -r '.config.Cmd // [] | length' "$config")" = 0 ] \
    || { echo "Cmd must be empty so arguments go to the entrypoint"; exit 1; }
  [ "$(jq -r '.config.User' "$config")" = "65534:65534" ] \
    || { echo "User must be 65534:65534"; exit 1; }

  # The entrypoint has to start without a home directory or a passwd entry.
  HOME=/nonexistent ${pkgs.lib.getExe package} apply --help > help.txt
  grep -q -- '--configFile' help.txt

  touch $out
''
