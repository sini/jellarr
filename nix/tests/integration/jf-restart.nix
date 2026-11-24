{
  pkgs,
  jellyfinPackage,
  ...
}:
pkgs.testers.runNixOSTest {
  extraPythonPackages = p: [p.pyhamcrest];

  globalTimeout = 1500;

  name = "jellarr-jf-restart";

  nodes.server = {
    imports = [
      ./base.nix
    ];

    services.jellyfin.package = jellyfinPackage;

    services.jellarr.config = {
      base_url = "http://localhost:8096";
      system.uiCulture = "en-GB";
      version = 1;
    };

    # one switch that restarts Jellyfin and also re-runs jellarr
    specialisation.restart.configuration = {
      services.jellarr.config.system.uiCulture = pkgs.lib.mkForce "de-DE";
      systemd.services.jellyfin.environment.JELLARR_TEST_MARK = "2";
    };
  };

  testScript =
    # py
    ''
      ${builtins.readFile ./library-update.py}
      ${builtins.readFile ./jf-restart.py}
      run_jf_restart_test(server)
    '';
}
