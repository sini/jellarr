{
  pkgs,
  jellyfinPackage,
  ...
}:
pkgs.testers.runNixOSTest {
  extraPythonPackages = p: [p.pyhamcrest];

  globalTimeout = 3000;

  name = "jellarr-gaps";

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
      ${builtins.readFile ./gaps.py}
      run_gaps_test(server)
    '';
}
