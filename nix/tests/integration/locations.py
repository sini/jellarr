CONFIG = "/tmp/jellarr-locations.yml"
LIBRARY_DIR = "/var/lib/jellyfin/root/default/Movies"

CONFIG_YAML = """version: 1
base_url: http://localhost:8096
system: {}
library:
  virtualFolders:
    - name: Movies
      collectionType: movies
      libraryOptions:
        pathInfos:
          - path: /mnt/m/a
          - path: /mnt/m/b
"""


def jellarr(server):
    jellarr_bin = server.succeed(
        "systemctl cat jellarr.service | sed -n 's/^ExecStart=//p'"
    ).strip()
    return server.succeed(
        f"cd /var/lib/jellarr && JELLARR_API_KEY=test-api-key {jellarr_bin} apply --configFile {CONFIG} 2>&1"
    )


def links(server, path):
    out = server.succeed(
        f"grep -l -x -F '{path}' {LIBRARY_DIR}/*.mblink | wc -l || true"
    )
    return int(out.strip())


def locations(server):
    folders = get_jellyfin_data(server, "/Library/VirtualFolders")
    return sorted(f for f in folders if f["Name"] == "Movies")[0]["Locations"]


def run_locations_test(server):
    wait_for_machine(server)
    wait_for_bootstrap(server)
    server.succeed("mkdir -p /mnt/m/a /mnt/m/b /mnt/m/c && chmod -R 755 /mnt/m")
    server.succeed(f"cat > {CONFIG} <<'EOF'\n{CONFIG_YAML}EOF")

    first = jellarr(server)
    print(first)
    assert sorted(locations(server)) == ["/mnt/m/a", "/mnt/m/b"], locations(server)

    # a stale location and a second link to a declared folder, as an old setup leaves them
    server.succeed(f"printf '/mnt/m/c' > {LIBRARY_DIR}/stale.mblink")
    server.succeed(f"printf '/mnt/m/b' > {LIBRARY_DIR}/dup.mblink")
    server.succeed(f"chown jellyfin:jellyfin {LIBRARY_DIR}/*.mblink")
    planted = sorted(locations(server))
    print(f"planted locations: {planted}")
    assert planted == ["/mnt/m/a", "/mnt/m/b", "/mnt/m/b", "/mnt/m/c"], planted

    second = jellarr(server)
    print(second)
    assert "→ reconciling library locations" in second, second

    assert sorted(locations(server)) == ["/mnt/m/a", "/mnt/m/b"], locations(server)
    assert links(server, "/mnt/m/a") == 1
    assert links(server, "/mnt/m/b") == 1
    assert links(server, "/mnt/m/c") == 0
    opts = get_jellyfin_data(server, "/Library/VirtualFolders")[0]["LibraryOptions"]
    assert sorted(p["Path"] for p in opts["PathInfos"]) == [
        "/mnt/m/a",
        "/mnt/m/b",
    ], opts["PathInfos"]

    third = jellarr(server)
    print(third)
    assert "→ reconciling" not in third and "→ updating library" not in third, third
    assert "✓ library config already up to date" in third, third
    print("✅ LOCATIONS test passed")
