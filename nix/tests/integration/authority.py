CONFIG = "/tmp/jellarr-authority.yml"
PLUGINS_DIR = "/var/lib/jellyfin/plugins"
TICKS = 10_000_000
LIBRARY_PATHS = ["/mnt/movies", "/mnt/extra", "/mnt/spared"]

# Every authoritative flag is on. The declared set is: user boss, library
# Movies, API key declared-key, plugin none. Everything else on the server is
# extra, protected (the active key "jellarr"), or listed under keep.
CONFIG_YAML = """version: 1
base_url: http://localhost:8096
system: {}
authoritative:
  users: true
  libraries: true
  plugins: true
  apiKeys: true
  keep:
    users: [keeper]
    libraries: [Spared]
    plugins: [Spared Plugin]
    apiKeys: [keep-key]
users:
  - name: boss
    password: bosspw
    policy:
      isAdministrator: true
library:
  virtualFolders:
    - name: Movies
      collectionType: movies
      libraryOptions:
        pathInfos:
          - path: /mnt/movies
api_keys:
  - name: declared-key
scheduledTasks:
  - key: RefreshLibrary
    triggers:
      - type: DailyTrigger
        timeOfDay: "03:30"
        maxRuntime: 2h
      - type: IntervalTrigger
        interval: 6h
      - type: WeeklyTrigger
        dayOfWeek: Sunday
        timeOfDay: "04:00"
"""

# Empty lists must not wipe the server.
EMPTY_LIST_YAML = """version: 1
base_url: http://localhost:8096
system: {}
authoritative:
  libraries: true
library:
  virtualFolders: []
"""

# boss is the only administrator and is not declared: refused.
LAST_ADMIN_YAML = """version: 1
base_url: http://localhost:8096
system: {}
authoritative:
  users: true
  allowMassDelete: true
users:
  - name: keeper
    password: keeperpw
"""

UNKNOWN_TASK_YAML = """version: 1
base_url: http://localhost:8096
system: {}
scheduledTasks:
  - key: NoSuchTask
    triggers: []
"""

# Signs in as boss with its password, since no API key is given.
SIGNED_IN_YAML = """version: 1
base_url: http://localhost:8096
system: {}
authoritative:
  users: true
users:
  - name: boss
    password: bosspw
    policy:
      isAdministrator: true
  - name: keeper
    password: keeperpw
"""


MARKER = "jellarr.disabledAt"


def disable_yaml(keep, after=None, scope=None, mass=False):
    """Disable mode: boss is the declared administrator; keep names are spared."""
    after_line = f"  deleteDisabledAfter: {after}\n" if after else ""
    after_line += (
        f"  usersScope: {{authenticationProviderId: {scope}}}\n" if scope else ""
    )
    after_line += "  allowMassDelete: true\n" if mass else ""
    return f"""version: 1
base_url: http://localhost:8096
system: {{}}
authoritative:
  users: disable
{after_line}  keep:
    users: [{", ".join(keep)}]
users:
  - name: boss
    password: bosspw
    policy:
      isAdministrator: true
"""


def user_by_name(server, name):
    return [u for u in get_jellyfin_data(server, "/Users") if u["Name"] == name][0]


def marker(server, name):
    """jellarr's disabledAt marker, read back through the DisplayPreferences API."""
    uid = user_by_name(server, name)["Id"]
    prefs = get_jellyfin_data(
        server, f"/DisplayPreferences/jellarr?userId={uid}&client=jellarr"
    )
    return (prefs.get("CustomPrefs") or {}).get(MARKER)


def disabled(server, name):
    return user_by_name(server, name)["Policy"]["IsDisabled"]


def write_config(server, text):
    server.succeed(f"cat > {CONFIG} <<'EOF'\n{text}EOF")


def jellarr_bin(server):
    return server.succeed(
        "systemctl cat jellarr.service | sed -n 's/^ExecStart=//p'"
    ).strip()


def run(server, flags="", env="JELLARR_API_KEY=test-api-key"):
    """Runs jellarr and returns (exit status, output)."""
    return server.execute(
        f"cd /var/lib/jellarr && env {env} {jellarr_bin(server)} apply --configFile {CONFIG} {flags} 2>&1"
    )


def run_ok(server, flags="", env="JELLARR_API_KEY=test-api-key"):
    status, out = run(server, flags, env)
    print(out)
    assert status == 0, f"jellarr exited {status}:\n{out}"
    return out


def run_fails(server, expected, flags=""):
    status, out = run(server, flags)
    print(out)
    assert status not in (0, 2), f"expected a failure, got exit {status}:\n{out}"
    assert expected in out, f"missing {expected!r} in:\n{out}"
    return out


def api_post(server, endpoint, body=None):
    data = f" -d '{json.dumps(body)}'" if body is not None else ""
    server.succeed(
        f"curl -sf -X POST 'http://localhost:8096{endpoint}' "
        f"-H 'Authorization: MediaBrowser Token=\"test-api-key\"' "
        f"-H 'Content-Type: application/json'{data}"
    )


def user_names(server):
    return sorted(u["Name"] for u in get_jellyfin_data(server, "/Users"))


def library_names(server):
    return sorted(
        f["Name"] for f in get_jellyfin_data(server, "/Library/VirtualFolders")
    )


def key_names(server):
    return sorted(
        k["AppName"] for k in get_jellyfin_data(server, "/Auth/Keys")["Items"]
    )


def plugins(server):
    return get_jellyfin_data(server, "/Plugins")


def plant_plugin(server, name, guid):
    """A plugin directory with a manifest and a placeholder assembly that fails to load: the server lists it, and as a plugin under its plugins directory it is removable."""
    folder = f"{PLUGINS_DIR}/{name.replace(' ', '')}_1.0.0.0"
    manifest = {
        "category": "General",
        "guid": guid,
        "name": name,
        "description": "",
        "owner": "",
        "overview": "",
        "targetAbi": "10.11.0.0",
        "timestamp": "2025-01-01T00:00:00.0000000Z",
        "version": "1.0.0.0",
        "status": "Active",
        "autoUpdate": False,
        "imagePath": "",
        "assemblies": [f"{name.replace(' ', '')}.dll"],
    }
    server.succeed(f"mkdir -p '{folder}'")
    server.succeed(f"cat > '{folder}/meta.json' <<'EOF'\n{json.dumps(manifest)}\nEOF")
    server.succeed(f"printf 'not an assembly' > '{folder}/{name.replace(' ', '')}.dll'")
    server.succeed(f"chown -R jellyfin:jellyfin '{folder}'")


def restart_jellyfin(server):
    server.succeed("systemctl restart jellyfin.service")
    server.wait_for_open_port(8096)
    server.wait_until_succeeds(
        "curl -sf 'http://localhost:8096/System/Configuration' -H 'Authorization: MediaBrowser Token=\"test-api-key\"'",
        timeout=WAIT_TIMEOUT,
    )


def triggers(server, key):
    task = [t for t in get_jellyfin_data(server, "/ScheduledTasks") if t["Key"] == key][
        0
    ]
    return sorted(
        (
            t["Type"],
            t.get("TimeOfDayTicks"),
            t.get("IntervalTicks"),
            t.get("DayOfWeek"),
            t.get("MaxRuntimeTicks"),
        )
        for t in task["Triggers"]
    )


def run_authority_test(server):
    wait_for_machine(server)
    wait_for_bootstrap(server)
    server.succeed("mkdir -p " + " ".join(LIBRARY_PATHS) + " && chmod -R 755 /mnt")

    # --- the server holds extras jellarr's config does not declare ---
    for name, password in [("boss", "bosspw"), ("extra", "x"), ("keeper", "keeperpw")]:
        api_post(server, "/Users/New", {"Name": name, "Password": password})
    for name, path in [
        ("Movies", "/mnt/movies"),
        ("Extra", "/mnt/extra"),
        ("Spared", "/mnt/spared"),
    ]:
        api_post(
            server,
            f"/Library/VirtualFolders?name={name}&collectionType=movies&refreshLibrary=false",
            {"LibraryOptions": {"PathInfos": [{"Path": path}]}},
        )
    for name in ["extra-key", "keep-key"]:
        api_post(server, f"/Auth/Keys?app={name}")
    plant_plugin(server, "Planted", "11111111-2222-3333-4444-555555555551")
    plant_plugin(server, "Spared Plugin", "11111111-2222-3333-4444-555555555552")
    restart_jellyfin(server)

    removable = {p["Name"] for p in plugins(server) if p["CanUninstall"]}
    bundled = {p["Name"] for p in plugins(server) if not p["CanUninstall"]}
    print(f"removable plugins: {sorted(removable)}; bundled: {sorted(bundled)}")
    plugin_checked = {"Planted", "Spared Plugin"} <= removable

    assert user_names(server) == ["boss", "extra", "keeper"], user_names(server)
    assert library_names(server) == ["Extra", "Movies", "Spared"], library_names(server)
    assert "extra-key" in key_names(server) and "jellarr" in key_names(server)

    # --- a dry run lists every deletion and changes nothing ---
    write_config(server, CONFIG_YAML)
    status, out = run(server, "--dry-run")
    print(out)
    assert status == 2, f"dry run exited {status}:\n{out}"
    assert (
        "DESTRUCTIVE user extra: would be deleted, and its watch history is lost" in out
    ), out
    assert "DESTRUCTIVE library Extra: would be deleted" in out, out
    assert "DESTRUCTIVE api key extra-key: would be revoked" in out, out
    assert (
        "DESTRUCTIVE user keeper" not in out and "DESTRUCTIVE library Spared" not in out
    ), out
    assert user_names(server) == ["boss", "extra", "keeper"]
    assert library_names(server) == ["Extra", "Movies", "Spared"]
    assert "extra-key" in key_names(server)

    # --- the real run deletes the extras and spares the protected ---
    out = run_ok(server)
    assert "→ deleting entries the config does not declare" in out, out
    assert user_names(server) == ["boss", "keeper"], user_names(server)
    assert library_names(server) == ["Movies", "Spared"], library_names(server)
    keys = key_names(server)
    # the key jellarr runs with is not declared and still survives; so does the kept one
    assert "extra-key" not in keys, keys
    assert "jellarr" in keys and "keep-key" in keys and "declared-key" in keys, keys
    names_after = {p["Name"] for p in plugins(server)}
    assert (
        bundled <= names_after
    ), f"a bundled plugin was touched: {bundled - names_after}"
    if plugin_checked:
        assert (
            "Planted" not in names_after and "Spared Plugin" in names_after
        ), names_after
    else:
        print(
            f"NOTE: no plant became removable offline ({sorted(removable)}); plugin deletion is covered by unit tests only"
        )
    boss = [u for u in get_jellyfin_data(server, "/Users") if u["Name"] == "boss"][0]
    assert boss["Policy"]["IsAdministrator"] is True

    # --- scheduled task triggers read back ---
    expected = sorted(
        [
            ("DailyTrigger", (3 * 3600 + 30 * 60) * TICKS, None, None, 7200 * TICKS),
            ("IntervalTrigger", None, 6 * 3600 * TICKS, None, None),
            ("WeeklyTrigger", 4 * 3600 * TICKS, None, "Sunday", None),
        ],
        key=repr,
    )
    got = sorted(triggers(server, "RefreshLibrary"), key=repr)
    assert got == expected, f"triggers {got} != {expected}"

    # --- a second run changes nothing ---
    out = run_ok(server)
    for live in ("→ ", "Creating", "Deleting", "Setting triggers"):
        if live == "→ ":
            # only the waiting-for-health line may carry the arrow
            lines = [
                ln
                for ln in out.splitlines()
                if ln.startswith("→ ") and "healthy" not in ln
            ]
            assert not lines, f"second run still acts: {lines}\n{out}"
        else:
            assert live not in out, f"second run still acts ({live}):\n{out}"
    assert "✓ nothing undeclared to delete" in out, out
    assert "✓ scheduled task triggers already up to date" in out, out

    # --- rails that refuse ---
    write_config(server, EMPTY_LIST_YAML)
    run_fails(server, "allowMassDelete")
    assert library_names(server) == [
        "Movies",
        "Spared",
    ], "the empty list deleted libraries"

    write_config(server, LAST_ADMIN_YAML)
    run_fails(server, "last administrator")
    assert user_names(server) == [
        "boss",
        "keeper",
    ], "the last administrator was deleted"

    write_config(server, UNKNOWN_TASK_YAML)
    run_fails(server, "valid keys:")

    # --- signed in with a password instead of an API key: that user is spared ---
    api_post(server, "/Users/New", {"Name": "extra2", "Password": "x"})
    write_config(server, SIGNED_IN_YAML)
    run_ok(server, env="JELLARR_API_KEY=")
    assert user_names(server) == ["boss", "keeper"], user_names(server)

    # --- disable mode: disable, re-enable, delete after, and idempotence ---
    for name in ["x1", "x2"]:
        api_post(server, "/Users/New", {"Name": name, "Password": "x"})

    write_config(server, disable_yaml(["keeper"]))
    status, out = run(server, "--dry-run")
    print(out)
    assert status == 2, f"dry run exited {status}:\n{out}"
    assert "would disable user x1 (not declared or kept); never deleted" in out, out
    assert not disabled(server, "x1") and marker(server, "x1") is None

    run_ok(server)
    for name in ["x1", "x2"]:
        assert disabled(server, name), f"{name} was not disabled"
        assert marker(server, name), f"{name} carries no marker"
    assert not disabled(server, "keeper") and marker(server, "keeper") is None
    assert user_names(server) == ["boss", "keeper", "x1", "x2"], user_names(server)

    # kept again, with a marker: re-enabled and the marker removed
    first_marker = marker(server, "x1")
    write_config(server, disable_yaml(["keeper", "x1"]))
    run_ok(server)
    assert not disabled(server, "x1")
    # a POST without the key must really drop it: read the prefs back
    uid1 = user_by_name(server, "x1")["Id"]
    prefs = get_jellyfin_data(
        server, f"/DisplayPreferences/jellarr?userId={uid1}&client=jellarr"
    )
    assert MARKER not in (prefs.get("CustomPrefs") or {}), prefs
    assert disabled(server, "x2") and marker(server, "x2")

    # dropped from keep again: disabled with a fresh, newer marker
    write_config(server, disable_yaml(["keeper"]))
    run_ok(server)
    second_marker = marker(server, "x1")
    assert disabled(server, "x1") and second_marker, second_marker
    assert second_marker > first_marker, (first_marker, second_marker)
    write_config(server, disable_yaml(["keeper", "x1"]))
    run_ok(server)
    assert not disabled(server, "x1") and marker(server, "x1") is None

    # disabled by an administrator, no marker: kept does not re-enable it
    keeper = user_by_name(server, "keeper")
    api_post(
        server,
        f"/Users/{keeper['Id']}/Policy",
        {**keeper["Policy"], "IsDisabled": True},
    )
    run_ok(server)
    assert disabled(server, "keeper") and marker(server, "keeper") is None

    # a marker past the threshold: deleted
    uid = user_by_name(server, "x2")["Id"]
    api_post(
        server,
        f"/DisplayPreferences/jellarr?userId={uid}&client=jellarr",
        {"CustomPrefs": {MARKER: "2020-01-01T00:00:00.000Z"}},
    )
    write_config(server, disable_yaml(["keeper", "x1"], after="1d"))
    status, out = run(server, "--dry-run")
    print(out)
    assert "would delete user x2 (disabled by jellarr since 2020-01-01" in out, out
    assert "x2" in user_names(server)
    run_ok(server)
    assert user_names(server) == ["boss", "keeper", "x1"], user_names(server)

    # a second run changes nothing
    out = run_ok(server)
    assert "✓ nothing undeclared to delete" in out, out
    assert disabled(server, "keeper") and not disabled(server, "x1")

    # --- usersScope: only users of the named authentication provider are candidates ---
    provider = "test.provider"
    for name in ["s1", "s2"]:
        api_post(server, "/Users/New", {"Name": name, "Password": "x"})
        user = user_by_name(server, name)
        api_post(
            server,
            f"/Users/{user['Id']}/Policy",
            {**user["Policy"], "AuthenticationProviderId": provider},
        )
    if user_by_name(server, "s1")["Policy"]["AuthenticationProviderId"] == provider:
        write_config(server, disable_yaml(["keeper"], scope=provider, mass=True))
        run_ok(server)
        for name in ["s1", "s2"]:
            assert disabled(server, name) and marker(server, name), name
        # out of scope: the default-provider users are untouched
        assert not disabled(server, "x1") and marker(server, "x1") is None
        assert disabled(server, "keeper") and marker(server, "keeper") is None
        assert user_names(server) == ["boss", "keeper", "s1", "s2", "x1"]
    else:
        print(
            "NOTE: Jellyfin kept the default AuthenticationProviderId; usersScope is covered by unit tests only"
        )
    print("✅ AUTHORITY test passed")
