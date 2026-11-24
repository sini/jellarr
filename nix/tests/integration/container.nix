{
  pkgs,
  jellyfinPackage,
  image,
  ...
}:
pkgs.testers.runNixOSTest {
  extraPythonPackages = p: [p.pyhamcrest];

  globalTimeout = 1500;

  name = "jellarr-container";

  nodes.server = {
    imports = [
      ./base.nix
    ];

    services.jellyfin.package = jellyfinPackage;

    services.jellarr.config = {
      base_url = "http://localhost:8096";
      system = {};
      version = 1;
    };

    virtualisation = {
      podman.enable = true;
      memorySize = 2048;
    };
  };

  testScript =
    # py
    ''
      ${builtins.readFile ./library-update.py}
      IMAGE = "${image}"
      ${builtins.readFile ./container.py}
      run_container_test(server)
    '';
}
