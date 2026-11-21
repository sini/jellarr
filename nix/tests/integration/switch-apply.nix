{pkgs}: let
  jellyfinStub = pkgs.runCommand "jellyfin-stub" {} ''
    mkdir -p $out/System/Info
    echo '{}' > $out/System/Info/Public
  '';
  stub = pkgs.writeShellScriptBin "jellarr" ''
    echo run >> runs
    sleep 20
  '';
in
  pkgs.testers.runNixOSTest {
    name = "jellarr-switch-apply";
    globalTimeout = 300;

    nodes.server = {
      imports = [../../module];

      services.jellarr = {
        enable = true;
        package = stub;
        config = {
          version = 1;
          base_url = "http://localhost:8096";
          system.uiCulture = "en-US";
        };
      };

      systemd.services.jellyfin-stub = {
        wantedBy = ["multi-user.target"];
        before = ["jellarr.service"];
        serviceConfig.ExecStart = "${pkgs.python3}/bin/python -m http.server 8096 --directory ${jellyfinStub}";
      };

      specialisation.changed.configuration.services.jellarr.config.system.uiCulture = pkgs.lib.mkForce "de-DE";
    };

    testScript = ''
      runs = "wc -l < /var/lib/jellarr/runs"
      def wait_idle():
          for _ in range(60):
              state = server.execute("systemctl is-active jellarr.service")[1].strip()
              print(f"jellarr.service state: {state!r}")
              if state == "inactive":
                  return
              server.sleep(1)
          raise Exception("jellarr.service never went idle")

      server.wait_for_unit("multi-user.target")
      # boot must not wait for a running jellarr
      assert server.execute("systemctl is-active jellarr.service")[1].strip() == "activating", "multi-user.target waited for jellarr"
      server.wait_until_succeeds(f"test $({runs}) -eq 1")
      wait_idle()

      server.succeed("systemctl is-active jellarr.timer")
      assert "RemainAfterExit=no" in server.succeed("systemctl show jellarr.service -p RemainAfterExit")

      server.succeed("/run/booted-system/specialisation/changed/bin/switch-to-configuration test")
      # switch must not wait for the run it triggers
      assert server.execute("systemctl is-active jellarr.service")[1].strip() == "activating", "switch waited for jellarr"
      server.wait_until_succeeds(f"test $({runs}) -eq 2")
      wait_idle()
      server.succeed("grep -q de-DE /var/lib/jellarr/config/config.yml")

      # exactly one run on switch
      server.sleep(5)
      server.succeed(f"test $({runs}) -eq 2")

      server.succeed("systemctl is-active jellarr.timer")
      server.succeed("systemctl start jellarr.service")
      server.succeed(f"test $({runs}) -eq 3")
    '';
  }
