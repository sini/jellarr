import base64
import hashlib
import struct
import zlib

CONFIG = "/tmp/jellarr-gaps.yml"
CONFIG_REMOVE_SPLASH = "/tmp/jellarr-gaps-remove-splash.yml"
CONFIG_CLEAR_RATING = "/tmp/jellarr-gaps-clear-rating.yml"
SPLASH = "/mnt/tv/splash.png"
LISTING_PASSWORD = "hunter2"


def make_png():
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    pixels = b"".join(b"\x00" + bytes([200, 30, 30]) * 2 for _ in range(2))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels))
        + chunk(b"IEND", b"")
    )


CONFIG_YAML = f"""version: 1
base_url: http://localhost:8096
system:
  metadataOptions:
    - itemType: Movie
      disabledMetadataSavers: [Nfo]
  contentTypes:
    - name: /mnt/tv
      value: movies
  pathSubstitutions:
    - from: /mnt/a
      to: /mnt/b
encoding:
  hlsAudioSeekStrategy: TranscodeAudio
branding:
  splashscreenEnabled: true
  splashscreenFile: {SPLASH}
users:
  - name: gapsuser
    password: userpw
    policy:
      isHidden: true
      maxParentalRating: 7
      maxActiveSessions: 3
      enableSubtitleManagement: true
      accessSchedules:
        - dayOfWeek: Weekday
          startHour: 8
          endHour: 20
livetv:
  guideDays: 5
  saveRecordingNfo: true
  tunerHosts:
    - type: m3u
      url: /mnt/tv/list.m3u
      friendlyName: offline
  listingProviders:
    - type: xmltv
      path: /mnt/tv/guide.xml
      enableAllTuners: true
    - type: SchedulesDirect
      username: someone
      listingsId: lineup1
      password: {LISTING_PASSWORD}
"""


CONFIG_REMOVE_SPLASH_YAML = """version: 1
base_url: http://localhost:8096
system: {}
branding:
  splashscreenEnabled: true
  removeSplashscreen: true
"""

CONFIG_CLEAR_RATING_YAML = """version: 1
base_url: http://localhost:8096
system: {}
users:
  - name: gapsuser
    password: userpw
    policy:
      maxParentalRating: null
"""


def jellarr(server, flags="", config=CONFIG):
    jellarr_bin = server.succeed(
        "systemctl cat jellarr.service | sed -n 's/^ExecStart=//p'"
    ).strip()
    status, output = server.execute(
        f"cd /var/lib/jellarr && JELLARR_API_KEY=test-api-key {jellarr_bin} apply --configFile {config} {flags} 2>&1"
    )
    # exit 2 means a dry run found changes pending
    assert status == 0 or (flags and status == 2), f"jellarr exited {status}:\n{output}"
    return output


def api(server, endpoint):
    return get_jellyfin_data(server, endpoint)


def is_jellyfin_12(server):
    version = api(server, "/System/Info/Public")["Version"]
    print(f"REAL BEHAVIOUR server version: {version}")
    return int(version.split(".")[0]) >= 12


def validate_version_dependent(server, output, jellyfin_12):
    seek = api(server, "/System/Configuration/encoding").get("HlsAudioSeekStrategy")
    warning = "encoding.HlsAudioSeekStrategy is not supported by Jellyfin"
    if jellyfin_12:
        assert seek == "TranscodeAudio", seek
        assert warning not in output, output
    else:
        assert seek is None, seek
        assert warning in output, f"no unsupported-field warning:\n{output}"
    print(f"12-only setting HlsAudioSeekStrategy on this server: {seek!r}")


def splashscreen_status(server):
    return int(
        server.succeed(
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:8096/Branding/Splashscreen"
        )
    )


def validate_applied(server, png):
    server.succeed(
        "curl -sf http://localhost:8096/Branding/Splashscreen -o /tmp/got.png"
    )
    got = server.succeed("base64 -w0 /tmp/got.png").strip()
    served_same = base64.b64decode(got) == png
    print(f"REAL BEHAVIOUR splashscreen GET returns uploaded bytes: {served_same}")
    assert served_same, "GET /Branding/Splashscreen did not return the uploaded bytes"

    livetv = api(server, "/System/Configuration/livetv")
    hosts = livetv["TunerHosts"]
    assert [(h["Type"], h["Url"]) for h in hosts] == [
        ("m3u", "/mnt/tv/list.m3u")
    ], hosts
    assert hosts[0]["FriendlyName"] == "offline"
    providers = {p["Type"]: p for p in livetv["ListingProviders"]}
    assert set(providers) == {"xmltv", "SchedulesDirect"}, providers
    assert providers["xmltv"]["Path"] == "/mnt/tv/guide.xml"
    stored = providers["SchedulesDirect"].get("Password")
    print(f"REAL BEHAVIOUR listings password stored as: {stored!r}")
    assert stored == hashlib.sha1(LISTING_PASSWORD.encode()).hexdigest(), stored
    assert livetv["GuideDays"] == 5 and livetv["SaveRecordingNFO"] is True

    users = [u for u in api(server, "/Users") if u["Name"] == "gapsuser"]
    assert len(users) == 1
    policy = users[0]["Policy"]
    assert policy["IsHidden"] is True
    assert policy["MaxActiveSessions"] == 3
    assert policy["MaxParentalRating"] == 7, policy["MaxParentalRating"]
    assert policy["EnableSubtitleManagement"] is True
    schedules = [
        (s["DayOfWeek"], s["StartHour"], s["EndHour"])
        for s in policy["AccessSchedules"]
    ]
    assert schedules == [("Weekday", 8.0, 20.0)], schedules

    system = api(server, "/System/Configuration")
    movie = [m for m in system["MetadataOptions"] if m["ItemType"] == "Movie"]
    assert movie and movie[0]["DisabledMetadataSavers"] == ["Nfo"], system[
        "MetadataOptions"
    ]
    assert {(c["Name"], c["Value"]) for c in system["ContentTypes"]} == {
        ("/mnt/tv", "movies")
    }
    assert {(p["From"], p["To"]) for p in system["PathSubstitutions"]} == {
        ("/mnt/a", "/mnt/b")
    }
    print("values read back through the API match")


# --- coverage stages: each applies, reads back, then applies again and must change nothing ---

LIVE = (
    "→ updating",
    "→ creating",
    "→ renaming",
    "→ changing",
    "→ restarting",
    "→ naming",
)
HEAD = "version: 1\nbase_url: http://localhost:8096\nsystem: {}\n"
KEY = "-H 'Authorization: MediaBrowser Token=\"test-api-key\"'"


def post(server, endpoint, body=None):
    data = f" -d '{json.dumps(body)}'" if body is not None else ""
    server.succeed(
        f"curl -sf -X POST 'http://localhost:8096{endpoint}' {KEY} "
        f"-H 'Content-Type: application/json'{data}"
    )


def cov(server, name, yaml, expect_fail=None, key=True, flags="", env=""):
    """Writes and applies a config; returns the output, asserting the exit status."""
    path = f"/tmp/cov-{name}.yml"
    server.succeed(f"cat > {path} <<'EOF'\n{HEAD}{yaml}EOF")
    jellarr_bin = server.succeed(
        "systemctl cat jellarr.service | sed -n 's/^ExecStart=//p'"
    ).strip()
    keyenv = "JELLARR_API_KEY=test-api-key" if key else "-u JELLARR_API_KEY"
    status, out = server.execute(
        f"cd /var/lib/jellarr && env {keyenv} {env} {jellarr_bin} apply --configFile {path} {flags} 2>&1"
    )
    print(out)
    if expect_fail:
        assert status not in (0, 2) and expect_fail in out, f"{status}:\n{out}"
    else:
        # exit 2 means a dry run found changes pending
        assert status == 0 or (
            flags and status == 2
        ), f"jellarr exited {status}:\n{out}"
    return out


def twice(server, name, yaml, **kw):
    """Applies, then applies again and asserts the second run changed nothing."""
    cov(server, name, yaml, **kw)
    again = cov(server, f"{name}-again", yaml, **kw)
    for live in LIVE:
        assert live not in again, f"{name}: second run still changes ({live}):\n{again}"


def user_id(server, name):
    return [u for u in api(server, "/Users") if u["Name"] == name][0]["Id"]


def folders(server):
    return {f["Name"]: f for f in api(server, "/Library/VirtualFolders")}


def folder_id(folder):
    print(f"REAL BEHAVIOUR folder keys: {sorted(folder)}")
    return folder.get("ItemId") or folder.get("Id")


def prefs(server, uid, ident, client):
    return api(server, f"/DisplayPreferences/{ident}?userId={uid}&client={client}")


def cov_library(server):
    server.succeed("mkdir -p /mnt/films && chmod 755 /mnt/films")
    films = (
        "library:\n  virtualFolders:\n    - name: Films\n      collectionType: movies\n"
        "      libraryOptions:\n        pathInfos: [{path: /mnt/films}]\n"
    )
    twice(server, "films", films)
    before = folder_id(folders(server)["Films"])
    renamed = (
        "library:\n  virtualFolders:\n    - name: Movies\n      renameFrom: Films\n"
        "      collectionType: movies\n      libraryOptions:\n        pathInfos: [{path: /mnt/films}]\n"
        "        typeOptions:\n          - type: Movie\n            metadataFetchers: []\n"
        "            imageFetchers: []\n            imageOptions:\n"
        "              - {type: Backdrop, limit: 2, minWidth: 1280}\n"
        "              - {type: Primary, limit: 1, minWidth: 0}\n"
    )
    twice(server, "movies", renamed)
    found = folders(server)
    assert list(found) == ["Movies"], list(found)
    # the item id derives from the folder path, so it changes with the name
    print(
        f"REAL BEHAVIOUR library id before {before!r} after {folder_id(found['Movies'])!r}"
    )
    assert found["Movies"]["Locations"] == ["/mnt/films"], found["Movies"]
    movie = [
        t
        for t in found["Movies"]["LibraryOptions"]["TypeOptions"]
        if t["Type"] == "Movie"
    ][0]
    got = sorted((i["Type"], i["Limit"], i["MinWidth"]) for i in movie["ImageOptions"])
    assert got == [("Backdrop", 2, 1280), ("Primary", 1, 0)], got
    print("✓ library rename and imageOptions")


def cov_nfo(server):
    uid = user_id(server, "gapsuser")
    nfo = (
        "xbmcMetadata:\n  releaseDateFormat: yyyy-MM-dd\n  saveImagePathsInNfo: true\n"
        f"  enablePathSubstitution: false\n  enableExtraThumbsDuplication: true\n  userId: '{uid}'\n"
    )
    twice(server, "nfo", nfo)
    got = api(server, "/System/Configuration/xbmcmetadata")
    assert got["ReleaseDateFormat"] == "yyyy-MM-dd", got
    assert got["SaveImagePathsInNfo"] is True, got
    assert got["EnablePathSubstitution"] is False, got
    assert got["EnableExtraThumbsDuplication"] is True, got
    assert got["UserId"].replace("-", "") == uid.replace("-", ""), got
    print("✓ xbmcmetadata")


def cov_prefs(server):
    uid = user_id(server, "gapsuser")
    post(
        server,
        f"/DisplayPreferences/usersettings?userId={uid}&client=emby",
        {"Id": "usersettings", "Client": "emby", "CustomPrefs": {"keep": "me"}},
    )
    post(
        server,
        f"/DisplayPreferences/jellarr?userId={uid}&client=jellarr",
        {
            "Id": "jellarr",
            "Client": "jellarr",
            "CustomPrefs": {"jellarr.disabledAt": "x"},
        },
    )
    users = (
        "users:\n  - name: gapsuser\n    password: userpw\n    displayPreferences:\n"
        "      - client: emby\n        sortOrder: Descending\n        showSidebar: true\n"
        "        customPrefs: {theme: dark, flag: true}\n"
    )
    twice(server, "prefs", users)
    got = prefs(server, uid, "usersettings", "emby")
    assert got["SortOrder"] == "Descending" and got["ShowSidebar"] is True, got
    # the server adds its own default prefs on read, so compare the declared and seeded keys
    custom = got["CustomPrefs"]
    assert (custom["keep"], custom["theme"], custom["flag"]) == (
        "me",
        "dark",
        "true",
    ), got
    marker = prefs(server, uid, "jellarr", "jellarr")["CustomPrefs"]
    assert marker["jellarr.disabledAt"] == "x", marker
    assert "theme" not in marker and "keep" not in marker, marker
    print("✓ display preferences")


def cov_providers(server):
    auth = api(server, "/Auth/Providers")[0]["Id"]
    reset = api(server, "/Auth/PasswordResetProviders")[0]["Id"]
    users = (
        "users:\n  - name: gapsuser\n    password: userpw\n    policy:\n"
        f"      authenticationProviderId: {auth}\n      passwordResetProviderId: {reset}\n"
    )
    twice(server, "prov", users)
    policy = [u for u in api(server, "/Users") if u["Name"] == "gapsuser"][0]["Policy"]
    assert policy["AuthenticationProviderId"] == auth, policy
    assert policy["PasswordResetProviderId"] == reset, policy
    bad = users.replace(auth, "Not.A.Provider")
    cov(server, "prov-bad", bad, expect_fail="is not a provider the server reports")
    policy = [u for u in api(server, "/Users") if u["Name"] == "gapsuser"][0]["Policy"]
    assert policy["AuthenticationProviderId"] == auth, "an unknown provider was written"
    print("✓ provider ids")


def sign_in_status(server, name, password):
    return int(
        server.succeed(
            "curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8096/Users/AuthenticateByName "
            "-H 'Content-Type: application/json' "
            '-H \'Authorization: MediaBrowser Client="cov", Device="cov", DeviceId="cov", Version="1"\' '
            f"-d '{json.dumps({'Username': name, 'Pw': password})}'"
        )
    )


def cov_rename(server):
    # gapsuser has an access schedule, which would forbid the sign-in below
    cov(server, "mover", "users:\n  - name: mover\n    password: userpw\n")
    uid = user_id(server, "mover")
    users = "users:\n  - name: renamed\n    renameFrom: mover\n    password: userpw\n"
    twice(server, "rename", users)
    names = sorted(u["Name"] for u in api(server, "/Users"))
    assert "mover" not in names and "renamed" in names, names
    assert user_id(server, "renamed") == uid, "rename created a new user"
    assert sign_in_status(server, "renamed", "userpw") == 200
    # a renamed administrator still signs in when there is no API key
    post(server, "/Users/New", {"Name": "root0", "Password": "rootpw"})
    rid = user_id(server, "root0")
    policy = [u for u in api(server, "/Users") if u["Id"] == rid][0]["Policy"]
    policy["IsAdministrator"] = True
    post(server, f"/Users/{rid}/Policy", policy)
    admin = (
        "users:\n  - name: root1\n    renameFrom: root0\n    password: rootpw\n"
        "    policy: {isAdministrator: true}\n"
    )
    out = cov(server, "admin", admin, key=False)
    assert "falling back to signing in as admin" in out, out
    assert user_id(server, "root1") == rid, "the admin rename created a new user"
    assert "root0" not in [u["Name"] for u in api(server, "/Users")]
    print("✓ user rename")


PLANTED = "/var/lib/jellyfin/plugins/Planted_1.0.0.0"


def plant(server, status):
    """A plugin folder whose assembly cannot load, with the manifest status given."""
    manifest = {
        "category": "General",
        "guid": "11111111-2222-3333-4444-555555555551",
        "name": "Planted",
        "description": "",
        "owner": "",
        "overview": "",
        "targetAbi": "10.11.0.0",
        "timestamp": "2025-01-01T00:00:00.0000000Z",
        "version": "1.0.0.0",
        "status": status,
        "autoUpdate": False,
        "imagePath": "",
        "assemblies": ["Planted.dll"],
    }
    server.succeed(f"mkdir -p {PLANTED}")
    server.succeed(f"cat > {PLANTED}/meta.json <<'EOF'\n{json.dumps(manifest)}\nEOF")
    server.succeed(f"printf 'not an assembly' > {PLANTED}/Planted.dll")
    server.succeed("chown -R jellyfin:jellyfin /var/lib/jellyfin/plugins")
    server.succeed("systemctl restart jellyfin.service")
    server.wait_for_open_port(8096)
    server.wait_until_succeeds(
        f"curl -sf 'http://localhost:8096/System/Configuration' {KEY}", timeout=300
    )


def plugin_status(server, name):
    return [p["Status"] for p in api(server, "/Plugins") if p["Name"] == name]


def cov_plugin(server):
    bundled = [
        p["Name"]
        for p in api(server, "/Plugins")
        if p["Status"] == "Active" and not p["CanUninstall"]
    ][0]
    print(f"REAL BEHAVIOUR bundled plugin used: {bundled}")
    # already active: nothing to do, and nothing restarts
    twice(server, "on", f"plugins:\n  - name: '{bundled}'\n    enabled: true\n")
    # a bundled plugin has no manifest to switch; jellarr says so up front
    off = f"plugins:\n  - name: '{bundled}'\n    enabled: false\n"
    cov(server, "off", off, expect_fail="is bundled with the server")
    assert plugin_status(server, bundled) == ["Active"], plugin_status(server, bundled)

    # a disabled plugin in the plugins directory: the dry run plans the enable
    plant(server, "Disabled")
    print(f"REAL BEHAVIOUR planted plugin status: {plugin_status(server, 'Planted')}")
    on = "plugins:\n  - name: Planted\n    enabled: true\n"
    dry = cov(server, "plan", on, flags="--dry-run")
    assert "plugin Planted: enable 1.0.0.0" in dry, dry
    assert '"status":"Disabled"' in server.succeed(f"cat {PLANTED}/meta.json").replace(
        " ", ""
    )
    # the real run enables it (the manifest changes, Jellyfin restarts), and then
    # fails honestly because the placeholder assembly cannot load (Malfunctioned)
    out = cov(
        server,
        "enable",
        on,
        expect_fail="did not become active",
        env="JELLARR_WAIT_TIMEOUT=30",
    )
    manifest = server.succeed(f"cat {PLANTED}/meta.json").replace(" ", "")
    print(f"REAL BEHAVIOUR manifest after enable: {manifest}")
    # the enable took effect: the status left Disabled, and the placeholder then failed to load
    assert '"status":"Disabled"' not in manifest, manifest
    assert "→ changing plugin states" in out, out
    print("✓ plugin enable")


def cov_defaults(server):
    """The opt-in defaults: passwords are not reconciled and ${VAR} is not expanded unless asked."""
    server.succeed("printf 'filepw\\n' > /tmp/cov-pw && chmod 644 /tmp/cov-pw")
    users = "users:\n  - name: pwuser\n    passwordFile: /tmp/cov-pw\n"
    cov(server, "pw-create", users)
    assert sign_in_status(server, "pwuser", "filepw") == 200
    uid = user_id(server, "pwuser")
    post(
        server, f"/Users/{uid}/Password", {"CurrentPw": "filepw", "NewPw": "changedpw"}
    )
    cov(server, "pw-default", users)
    assert (
        sign_in_status(server, "pwuser", "changedpw") == 200
    ), "default run reset the password"
    assert sign_in_status(server, "pwuser", "filepw") == 401
    cov(server, "pw-reconcile", "reconcilePasswords: true\n" + users)
    assert (
        sign_in_status(server, "pwuser", "filepw") == 200
    ), "reconcilePasswords did not set the password"
    assert sign_in_status(server, "pwuser", "changedpw") == 401
    print("✓ reconcilePasswords")

    def disclaimer():
        return api(server, "/Branding/Configuration").get("LoginDisclaimer")

    literal = "a ${HOME} b $${x}"
    cov(server, "env-default", f"branding:\n  loginDisclaimer: '{literal}'\n")
    assert disclaimer() == literal, disclaimer()
    cov(
        server,
        "env-on",
        "expandEnv: true\nbranding:\n  loginDisclaimer: 'v=${JF_COV_X} lit=$${x}'\n",
        env="JF_COV_X=hello",
    )
    assert disclaimer() == "v=hello lit=${x}", disclaimer()
    print("✓ expandEnv")


def run_cov_stages(server):
    cov_defaults(server)
    cov_library(server)
    cov_nfo(server)
    cov_prefs(server)
    cov_providers(server)
    cov_rename(server)
    cov_plugin(server)


def run_gaps_test(server):
    png = make_png()
    wait_for_machine(server)
    wait_for_bootstrap(server)
    server.succeed("mkdir -p /mnt/tv && chmod 755 /mnt/tv")
    server.succeed("printf '#EXTM3U\\n' > /mnt/tv/list.m3u")
    server.succeed("printf '<tv></tv>\\n' > /mnt/tv/guide.xml")
    server.succeed(f"echo {base64.b64encode(png).decode()} | base64 -d > {SPLASH}")
    server.succeed("chmod 644 /mnt/tv/*")
    server.succeed(f"cat > {CONFIG} <<'EOF'\n{CONFIG_YAML}EOF")

    jellyfin_12 = is_jellyfin_12(server)
    wizard_before = api(server, "/System/Info/Public")["StartupWizardCompleted"]
    print(f"REAL BEHAVIOUR StartupWizardCompleted before jellarr: {wizard_before!r}")
    first = jellarr(server)
    print(first)
    validate_applied(server, png)
    validate_version_dependent(server, first, jellyfin_12)

    second = jellarr(server)
    print(second)
    for live in ("→ updating", "→ uploading", "→ creating"):
        assert (
            live not in second
        ), f"second run still changes things ({live}):\n{second}"
    validate_version_dependent(server, second, jellyfin_12)
    # no startup block: the wizard state is left as it was
    assert (
        api(server, "/System/Info/Public")["StartupWizardCompleted"] == wizard_before
    ), "jellarr changed the startup wizard state without a startup block"

    # exit 2 means changes are pending; succeed() demands 0
    print(jellarr(server, "--dry-run"))
    validate_applied(server, png)

    # removing the custom splashscreen: only possible while it is enabled
    assert splashscreen_status(server) == 200
    server.succeed(
        f"cat > {CONFIG_REMOVE_SPLASH} <<'EOF'\n{CONFIG_REMOVE_SPLASH_YAML}EOF"
    )
    dry = jellarr(server, "--dry-run", CONFIG_REMOVE_SPLASH)
    assert "the custom image would be removed" in dry, dry
    assert splashscreen_status(server) == 200, "a dry run removed the splashscreen"
    removed = jellarr(server, config=CONFIG_REMOVE_SPLASH)
    print(removed)
    assert "✓ removed splashscreen" in removed, removed
    status = splashscreen_status(server)
    print(f"REAL BEHAVIOUR splashscreen GET after removal: {status}")
    assert status == 404, status
    again = jellarr(server, config=CONFIG_REMOVE_SPLASH)
    assert "→ removing" not in again, again
    assert "no custom splashscreen to remove" in again, again

    # clearing a parental rating with an explicit null
    server.succeed(
        f"cat > {CONFIG_CLEAR_RATING} <<'EOF'\n{CONFIG_CLEAR_RATING_YAML}EOF"
    )
    cleared = jellarr(server, config=CONFIG_CLEAR_RATING)
    print(cleared)
    policy = [u for u in api(server, "/Users") if u["Name"] == "gapsuser"][0]["Policy"]
    print(
        f"REAL BEHAVIOUR MaxParentalRating after null: {policy.get('MaxParentalRating')!r}"
    )
    assert policy.get("MaxParentalRating") is None, policy.get("MaxParentalRating")
    assert policy["IsHidden"] is True, "clearing the rating touched other policy fields"
    again = jellarr(server, config=CONFIG_CLEAR_RATING)
    assert "Updating user policy" not in again, again
    run_cov_stages(server)
    print("✅ GAPS test passed")
