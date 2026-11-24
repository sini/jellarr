{
  pkgs,
  jellyfinPackage,
  ...
}:
pkgs.testers.runNixOSTest {
  extraPythonPackages = p: [p.pyhamcrest];

  globalTimeout = 1500;

  name = "jellarr-network-restart";

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
  };

  testScript =
    # py
    ''
      ${builtins.readFile ./library-update.py}
      ${builtins.readFile ./network-restart.py}
      run_network_restart_test(server)
    '';
}
