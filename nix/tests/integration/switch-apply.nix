{pkgs}: let
  jellyfinStub = pkgs.runCommand "jellyfin-stub" {} ''
    mkdir -p $out/System/Info
    echo '{}' > $out/System/Info/Public
  '';
  stub = marker:
    pkgs.writeShellScriptBin "jellarr" ''
      echo ${marker} >> runs
      sleep 20
    '';
in
  pkgs.testers.runNixOSTest {
    name = "jellarr-switch-apply";
    globalTimeout = 600;

    nodes.server = {
      imports = [../../module];

      services.jellarr = {
        enable = true;
        package = stub "pkg-a";
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

      # applied cumulatively: base -> changed (config) -> bumped (package and config) -> pkgonly (package)
      specialisation = {
        changed.configuration.services.jellarr.config.system.uiCulture = pkgs.lib.mkForce "de-DE";
        bumped.configuration.services.jellarr.package = pkgs.lib.mkForce (stub "pkg-b");
        pkgonly.configuration.services.jellarr.package = pkgs.lib.mkForce (stub "pkg-c");
      };
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

      def switch(name, expected_runs, marker, wait_first=True):
          if wait_first:
              wait_idle()
          server.succeed(f"/run/booted-system/specialisation/{name}/bin/switch-to-configuration test")
          # switch must not wait for the run it triggers
          assert server.execute("systemctl is-active jellarr.service")[1].strip() == "activating", "switch waited for jellarr"
          server.wait_until_succeeds(f"test $({runs}) -eq {expected_runs}")
          wait_idle()
          # exactly one run on switch, by the new package
          server.sleep(5)
          server.succeed(f"test $({runs}) -eq {expected_runs}")
          last = server.succeed("tail -n1 /var/lib/jellarr/runs").strip()
          assert last == marker, f"{name}: ran {last}, expected {marker}"

      server.succeed("grep -qx pkg-a /var/lib/jellarr/runs")
      switch("changed", 2, "pkg-a")
      server.succeed("grep -q de-DE /var/lib/jellarr/config/config.yml")
      switch("bumped", 3, "pkg-b")
      server.succeed("grep -q en-US /var/lib/jellarr/config/config.yml")
      switch("pkgonly", 4, "pkg-c")
      # a switch while an older run is still going must still end in a run of the new package
      server.succeed("systemctl start --no-block jellarr.service")
      server.wait_until_succeeds(f"test $({runs}) -eq 5")
      switch("changed", 6, "pkg-a", wait_first=False)

      server.succeed("systemctl is-active jellarr.timer")
      server.succeed("systemctl start jellarr.service")
      server.succeed(f"test $({runs}) -eq 7")
    '';
  }
