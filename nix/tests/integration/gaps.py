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
    print("✅ GAPS test passed")
