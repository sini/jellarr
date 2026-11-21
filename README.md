# Jellarr

**Jellarr** is an open-source tool designed to simplify declarative
configuration management for [Jellyfin](https://jellyfin.org) media servers.
Inspired by [Configarr](https://github.com/raydak-labs/configarr)'s approach to
\*arr stack automation, Jellarr uses Jellyfin's official REST API to safely
apply configuration changes through version-controlled YAML files.

By streamlining server configuration, Jellarr saves time, enhances consistency
across environments, and reduces manual intervention.

---

## About this fork

This is a community-maintained fork of
[venkyr77/jellarr](https://github.com/venkyr77/jellarr). Upstream hasn't had a
commit since 2026-08-15, and several working pull requests are still waiting for
review there, so this fork collects that work in one place, tests it together,
and releases it.

Jellarr was created by [@venkyr77](https://github.com/venkyr77) (Venkatesan
Ravi), and everything in upstream's history is theirs and its contributors'.
This fork starts from [typedrat/jellarr](https://github.com/typedrat/jellarr)
and adds work from several other forks and open upstream pull requests. Here is
everything it carries beyond upstream `main`:

| From                                                       | What                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@venkyr77](https://github.com/venkyr77) (Venkatesan Ravi) | The unreleased v0.1.1 release branch (upstream #66)                                                                                                                                                                                                                                             |
| [@typedrat](https://github.com/typedrat) (Alexis Williams) | The consolidation this fork is based on; subtitle mode for users; plugins matched by catalog GUID and kept up to date; uninstalling superseded plugin copies; trickplay options mapped only when set; library `ignoreChanges`; tests run during the Nix build                                   |
| [@booxter](https://github.com/booxter) (Ihar Hrachyshka)   | Graceful handling of missing plugin configuration (upstream #71); an overridable package (#73); download and bitrate policies (#72); the user configuration endpoint fix; audio language preference; tag restrictions; per-user library order; metadata configuration; a library-update VM test |
| [@beefyhalo](https://github.com/beefyhalo) (Kevin Horlick) | Authentication with the `Authorization` header, which Jellyfin 12 requires (upstream #79)                                                                                                                                                                                                       |
| [@noamsto](https://github.com/noamsto) (Noam Stolero)      | Tone mapping options (upstream #82)                                                                                                                                                                                                                                                             |
| [@sini](https://github.com/sini) (Jason Bowman)            | Library update detection (upstream #69); full API coverage for networking, trickplay, encoding, library options and server configuration, plus declarative API keys (#68); the features listed below                                                                                            |
| [@arseneyr](https://github.com/arseneyr)                   | `{ _file: path }` secret references, since widened to the whole config alongside `${VAR}`                                                                                                                                                                                                       |
| [@cramt](https://github.com/cramt) (Alexandra Østermark)   | Startup wizard automation (upstream #60), adapted to sign in as the admin rather than write an API key                                                                                                                                                                                          |
| [@Jampard](https://github.com/Jampard)                     | The Jellyfin 12 branding route; the bootstrap deadlock fix; waiting for plugins to become Active after a restart                                                                                                                                                                                |
| [@ironoa](https://github.com/ironoa)                       | `response.ok` checks that catch empty-body 401s                                                                                                                                                                                                                                                 |

New in this fork:

- `--dry-run`: strictly read-only, prints `path: current → desired` for every
  pending change, masks secrets, and exits 0 / 2 / 1 for no change / changes
  pending / error, so it can gate CI or a deploy.
- Authentication falls back to signing in as the admin when no API key is set or
  the key is rejected; the API key can also come from `JELLARR_API_KEY_FILE`.
- `passwordFile` is reconciled for existing users without risking lockout or
  logging anyone out unnecessarily.
- Plugin installs and removals restart Jellyfin in the same run, so plugin
  configuration applies on the first pass.
- Declared arrays are authoritative in every module, and every module is tested
  to make no changes on a second run with the same config.
- The NixOS module orders after Jellyfin, re-applies on `nixos-rebuild switch`,
  takes `apiKeyFile` through systemd credentials, accepts `{ _file = ...; }`
  wherever it accepts a string, and can take a plain `configFile`.
- The NixOS VM tests run against both Jellyfin 10.11 and 12.

Coming from upstream v0.1.1? Read [CHANGELOG.md](CHANGELOG.md) first. A few
behaviours changed, most notably that strings containing `${NAME}` are now
expanded from the environment (write `$${` for a literal `${`).

Releases start at v0.3.0. Another fork has already published 0.2.x, and skipping
it keeps the two from being confused.

Commits taken from other forks are cherry-picked with their original author.
Where a change had to be rewritten, the commit carries `Co-authored-by` and
`Adapted-from` trailers that point at the source. If you maintain a fork with
work that isn't here, pull requests are welcome, and we'd rather converge than
split the community further. If upstream becomes active again, we'll offer all
of this back.

---

## Why Jellarr?

Managing Jellyfin configuration becomes painful at scale:

- **Configuration drift** across dev/staging/prod environments
- **No version control** for settings changes
- **Manual clicking** through web UI doesn't scale to multiple servers
- **No automation** for configuration-as-code workflows

Existing solutions have limitations. While
[declarative-jellyfin](https://github.com/Sveske-Juice/declarative-jellyfin)
pioneered declarative Jellyfin configuration, it takes a risky approach:

- Directly manipulates XML files and SQLite databases
- Stops/starts Jellyfin service multiple times during configuration
- Reimplements Jellyfin's internal UUID generation in bash
- NixOS-only with hardcoded systemd and path dependencies
- Breaks when Jellyfin changes internals
  ([example issue](https://github.com/Sveske-Juice/declarative-jellyfin/issues/13))

**Jellarr takes a different approach:**

- ✅ **API-based** — Uses Jellyfin's official REST API, never touches internal
  files or databases
- ✅ **Zero service interruption** — Jellyfin keeps running; the only restart is
  the one a plugin install or removal needs
- ✅ **Cross-platform** — Works on Docker, bare metal, any OS (not just NixOS)
- ✅ **Type-safe** — OpenAPI-generated types catch errors at build time
- ✅ **Future-proof** — Relies on stable API contracts, not reverse-engineered
  internals
- ✅ **Production-ready** — Idempotent, safe to run anytime via cron/systemd
  timers

---

## Quick Start

```bash
# With Nix
nix run github:sini/jellarr/v0.3.0

# With Docker
docker pull ghcr.io/sini/jellarr:v0.3.0

# Download binary (requires Node.js 24+)
node jellarr-v0.3.0.cjs --configFile path/to/config.yml
```

**Example config** (`config/config.yml`):

```yaml
version: 1
base_url: "http://localhost:8096"
system:
    enableMetrics: true
    pluginRepositories:
        - name: "Jellyfin Official"
          url: "https://repo.jellyfin.org/releases/plugin/manifest.json"
          enabled: true
encoding:
    enableHardwareEncoding: true
    hardwareAccelerationType: "vaapi"
    vaapiDevice: "/dev/dri/renderD128"
```

---

## Installation

### Nix Flake (Recommended)

Add to your `flake.nix`:

```nix
{
  inputs.jellarr.url = "github:sini/jellarr";

  outputs = { self, nixpkgs, jellarr, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      modules = [
        jellarr.nixosModules.default
        ({ config, ... }: {
          services.jellarr = {
            enable = true;
            user = "jellyfin";
            group = "jellyfin";
            environmentFile = config.sops.templates.jellarr-env.path;
            config = {
              base_url = "http://localhost:8096";
              system.enableMetrics = true;
            };
          };
        })
      ];
    };
  };
}
```

Or run directly:

```bash
JELLARR_API_KEY=your_api_key nix run github:sini/jellarr/v0.3.0
```

### Docker (Recommended)

```bash
docker pull ghcr.io/sini/jellarr:v0.3.0
```

**With docker-compose:**

```yaml
services:
    jellarr:
        image: ghcr.io/sini/jellarr:v0.3.0
        container_name: jellarr
        environment:
            - JELLARR_API_KEY=${JELLARR_API_KEY}
            - TZ=Etc/UTC
        volumes:
            - ./config:/config
        restart: "no"
```

### Bundle Download

Download from [releases](https://github.com/sini/jellarr/releases) (requires
Node.js 24+):

```bash
curl -LO https://github.com/sini/jellarr/releases/download/v0.3.0/jellarr-v0.3.0.cjs
JELLARR_API_KEY=your_api_key node jellarr-v0.3.0.cjs --configFile path/to/config.yml
```

**Note:** Requires Node.js 24+ installed on your system.

---

## Export Existing Configuration (Experimental)

Already have a configured Jellyfin server? Use `dump` to export its current
configuration as a starting point:

```bash
JELLARR_API_KEY=your_api_key jellarr dump --baseUrl http://localhost:8096 > config.yml
```

This exports system settings, encoding options, libraries, branding, users
(without passwords), and plugin configurations. Edit the output to:

- Remove fields you don't want to manage
- Add `password` or `passwordFile` to users
- Remove any default values you don't need

See [`dumped-example.yml`](./dumped-example.yml) for sample output.

---

## Configuration

Jellarr uses a YAML configuration file (default: `config/config.yml`).

### System Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
system:
    enableMetrics: true # Enable Prometheus metrics endpoint
    serverName: "Jellyfin"
    preferredMetadataLanguage: "en"
    metadataCountryCode: "US"
    uiCulture: "en-US"
    corsHosts: [
        "*",
    ] # CORS allowed origins; configure here, not under networking
    imageSavingConvention: "Legacy" # Legacy | Compatible
    enableFolderView: false
    quickConnectAvailable: true
    libraryMonitorDelay: 60
    pluginRepositories:
        - name: "Jellyfin Official"
          url: "https://repo.jellyfin.org/releases/plugin/manifest.json"
          enabled: true
    trickplayOptions:
        enableHwAcceleration: true
        enableHwEncoding: true
        enableKeyFrameOnlyExtraction: true
        scanBehavior: "NonBlocking" # NonBlocking | Blocking
        processPriority: "BelowNormal" # Normal | Idle | High | RealTime | BelowNormal | AboveNormal
        interval: 10000
        widthResolutions: [320]
        tileWidth: 10
        tileHeight: 10
        qscale: 4
        jpegQuality: 90
        processThreads: 1
```

The full field set mirrors Jellyfin's `ServerConfiguration` object (46 scalar
fields including `corsHosts`). CORS allowed origins are configured under
`system`, not under a separate networking key.

### Encoding Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
encoding:
    enableHardwareEncoding: true
    hardwareAccelerationType: "vaapi" # none, amf, qsv, nvenc, v4l2m2m, vaapi, videotoolbox, rkmpp
    vaapiDevice: "/dev/dri/renderD128"
    # or qsv device
    qsvDevice: "/dev/dri/renderD128"
    hardwareDecodingCodecs:
        - h264
        - hevc
        - mpeg2video
        - vc1
        - vp8
        - vp9
        - av1
    enableDecodingColorDepth10Hevc: true
    enableDecodingColorDepth10HevcRext: true
    enableDecodingColorDepth12HevcRext: true
    enableDecodingColorDepth10Vp9: true
    allowHevcEncoding: false
    allowAv1Encoding: false
    # tonemapping
    enableTonemapping: true
    tonemappingAlgorithm: "bt2390" # none|clip|linear|gamma|reinhard|hable|mobius|bt2390
    tonemappingMode: "auto" # auto|max|rgb|lum|itp
    # encoder quality
    encoderPreset: "auto" # auto|placebo|veryslow|slower|slow|medium|fast|faster|veryfast|superfast|ultrafast
    h264Crf: 23
    h265Crf: 28
    # deinterlacing
    deinterlaceMethod: "yadif" # yadif|bwdif
    # subtitles and keyframes
    enableSubtitleExtraction: true
    allowOnDemandMetadataBasedKeyframeExtractionForExtensions:
        - mkv
```

The full field set mirrors Jellyfin's `EncodingOptions` object.

### Networking Configuration

Jellarr manages the full Jellyfin NetworkConfiguration via the `networking` key.

```yaml
version: 1
base_url: "http://localhost:8096"
networking:
    internalHttpPort: 8096
    publicHttpPort: 8096
    enableIPv6: true
    requireHttps: false
    publishedServerUriBySubnet:
        - "all=https://jellyfin.example.com"
    knownProxies:
        - "10.0.0.1"
    certificatePassword: "changeme"
```

`certificatePassword` is a sensitive value; store it securely rather than
committing it in plain text.

The full field set mirrors Jellyfin's `NetworkConfiguration` object. Note that
`corsHosts` is a `ServerConfiguration` field, not `NetworkConfiguration`, and is
not part of the `networking` key.

### Metadata Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
metadata:
    # Use the library scan time for Date Added, so later file metadata updates do
    # not make existing media appear newly added.
    useFileCreationTimeForDateAdded: false
```

The Jellyfin default is `true`. Leave this section out if you do not want
Jellarr to manage the setting.

### Library Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
library:
    virtualFolders:
        - name: "Movies"
          collectionType: "movies"
          libraryOptions:
              pathInfos:
                  - path: "/data/movies"
        - name: "Shows"
          collectionType: "tvshows"
          libraryOptions:
              pathInfos:
                  - path: "/data/tv"
              enableAutomaticSeriesGrouping: true
              preferredMetadataLanguage: "en"
              metadataCountryCode: "US"
              allowEmbeddedSubtitles: "AllowAll" # AllowAll|AllowText|AllowImage|AllowNone
              subtitleDownloadLanguages:
                  - "eng"
              subtitleFetcherOrder:
                  - "Open Subtitles"
```

`ignoreChanges` lists library options that are only applied when the library is
created; after that, Jellarr leaves them as the server has them. This suits
options something else manages, such as the paths a plugin like Shokofin
rewrites to point at its virtual file system:

```yaml
library:
    virtualFolders:
        - name: "Anime"
          collectionType: "tvshows"
          libraryOptions:
              pathInfos:
                  - path: "/data/anime"
          ignoreChanges:
              - pathInfos
```

The full field set mirrors Jellyfin's `LibraryOptions` object.

### Branding Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
branding:
    loginDisclaimer: |
        Configured by <a href="https://github.com/venkyr77/jellarr">Jellarr</a>
    customCss: |
        @import url("https://cdn.jsdelivr.net/npm/jellyskin@latest/dist/main.css");
    splashscreenEnabled: false
```

### User Management

```yaml
version: 1
base_url: "http://localhost:8096"
users:
    # Regular user with plaintext password (development only)
    - name: "regular-user"
      password: "secure-password"

    # Regular user with password file (production recommended)
    - name: "viewer-user"
      passwordFile: "/run/secrets/viewer-password"
      audioLanguagePreference: "rus"
      playDefaultAudioTrack: false
      orderedLibraries: ["Movies", "Shows"]

    # Admin user with policy configuration
    - name: "admin-user"
      passwordFile: "/run/secrets/admin-password"
      policy:
          isAdministrator: true
          loginAttemptsBeforeLockout: 3
          enabledLibraries:
              - "Movies"
              - "Shows"
```

`policy.enabledLibraries` accepts library names; jellarr resolves them to folder
IDs when talking to the Jellyfin API.

`orderedLibraries` sets a user's home screen library order by library name. Omit
it to preserve their order, or use `[]` to reset it. Unlisted libraries follow
the listed ones; this setting does not change library access.

`policy.allowedTags` limits visible content to items with the specified tags;
`policy.blockedTags` hides matching items. These filters apply within the user's
accessible libraries. Omit either setting to preserve it, or use `[]` to clear
it.

**Password Security:**

- **plaintext password**: Use `password` field for development/testing only
- **password file**: Use `passwordFile` for production - file contains only the
  plaintext password (whitespace is trimmed)
- **Exactly one required**: Each user must specify either `password` or
  `passwordFile` (not both)

**Declared arrays are authoritative:** in every section, an array you declare
replaces the server's array whole (shrinking, emptying and reordering all land);
an array you omit is left alone. The one exception is
`policy.enabledLibraries:
[]`, which is ignored rather than removing all library
access; omit it or list libraries instead.

**Password reconciliation:** on every run, an existing user whose password
differs from the configured one has it set (`POST /Users/Password`). Jellarr
finds out by signing in as that user under its own device id and signing out
again, which creates no lasting session. A failed sign-in counts towards
Jellyfin's `loginAttemptsBeforeLockout`, so a user for whom one more failure
would reach the limit is not probed; their password is set without a check. A
user whose sign-in is forbidden (disabled, parental schedule, remote access off)
is left unchanged with a warning. Setting a password signs the user out of their
other devices, which is why Jellarr only does it when the password differs. The
admin Jellarr signed in as by name is already verified and is not probed.

**sops-nix Integration:**

```nix
{
  sops.secrets = {
    jellarr-api-key.sopsFile = ../../../../secrets/jellarr-api-key;
    viewer-user-password.sopsFile = ../../../../secrets/viewer-user-password;
    admin-user-password.sopsFile = ../../../../secrets/admin-user-password;
  };

  services.jellarr = {
    enable = true;
    environmentFile = config.sops.templates.jellarr-env.path;
    config = {
      base_url = "http://localhost:8096";
      users = [
        {
          name = "viewer-user";
          passwordFile = config.sops.secrets.viewer-user-password.path;
        }
        {
          name = "admin-user";
          passwordFile = config.sops.secrets.admin-user-password.path;
        }
      ];
    };
  };
}
```

### Startup Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
system: {}
startup:
    serverName: "Home"
    preferredMetadataLanguage: "en"
    metadataCountryCode: "US"
    uiCulture: "en-US"
    remoteAccess:
        enableRemoteAccess: false
        enableAutomaticPortMapping: false
    user:
        name: "admin"
        passwordFile: "/run/secrets/jellyfin-admin-password" # or `password`
    completeStartupWizard: true # default; false leaves the wizard open
```

The first-boot wizard runs only against a pristine server, one whose
`GET /System/Info/Public` reports `StartupWizardCompleted: false`. Jellarr then
drives `/Startup/Configuration`, `/Startup/RemoteAccess`, `/Startup/User` and
`/Startup/Complete`, creates the admin from `user`, and signs in as that admin
for the rest of the run (see [Authentication](#authentication)). On a server
whose wizard is already complete the block does nothing. Jellarr never creates
or writes an API key here; supply `JELLARR_API_KEY` for later runs, or let it
sign in as the admin each time.

### API Keys

```yaml
version: 1
base_url: "http://localhost:8096"
api_keys:
    - name: "jellarr"
    - name: "my-integration"
```

Jellarr creates any API key whose name (`AppName`) doesn't already exist. It's
additive and idempotent: existing keys are never modified or deleted.

**Caveat:** calling `/Auth/Keys` needs an existing token, so this only adds
keys. Provision the first credential via the API-key bootstrap or the Jellyfin
dashboard.

### Plugin Management

```yaml
version: 1
base_url: "http://localhost:8096"
plugins:
    # Install plugin by name (from configured repositories)
    - name: "Trakt"

    # Install and configure plugin
    - name: "Trakt"
      configuration:
          TraktUsers:
              - ExtraLogging: true

    # Multiple plugins
    - name: "Playback Reporting"
    - name: "Fanart"
      configuration:
          EnableImages: true

    # Hold a plugin at a specific version
    - name: "Shoko"
      version: "6.0.5.4012"
```

**How it works:**

- Plugins are installed from repositories configured in
  `system.pluginRepositories`
- Plugin names must match the catalog name exactly (case-sensitive). Installed
  plugins are matched by the catalog entry's GUID, so a plugin that reports a
  different name once installed (e.g. "SSO Authentication" installs as
  "SSO-Auth") is still recognized
- Without `version`, each plugin is kept at the newest version its repositories
  offer for the running Jellyfin version, so changing a repository URL or
  upgrading Jellyfin upgrades the plugin on the next run
- With `version`, that version is installed and the plugin is held there.
  Jellyfin always loads the newest installed copy of a plugin, so a pin below
  the installed version is reported but not applied; uninstall the plugin to
  downgrade
- Once an upgraded plugin is active, its older copies that Jellyfin reports as
  `Superseded` are uninstalled (copies in any other state are left alone).
  Jellyfin keeps loading a superseded copy's assemblies, whose API routes then
  clash with the new copy's, so they're removed and Jellyfin is restarted again
  to unload them
- Jellyfin loads installed or upgraded plugins only after a restart, so when a
  run installs or removes a plugin Jellarr restarts it (`POST /System/Restart`),
  waits for `/health` to go down and come back (bounded by the
  [startup wait](#startup-wait) timeout), waits for the installed plugins to
  become Active, re-reads the plugin list and then applies plugin
  `configuration`, all in the same run
- A plugin declared with a `configuration` whose configuration cannot be read
  (not installed or loaded, disabled, or no configuration endpoint) fails the
  run with a non-zero exit. Plugins declared without a `configuration` that have
  none are skipped
- The `configuration` field accepts arbitrary key-value pairs specific to each
  plugin
- Only specified configuration fields are updated; unspecified fields are
  preserved

**Secrets: `_file` and `${VAR}`**

Both forms work anywhere in the config, not only in plugin `configuration`. They
are resolved on the parsed YAML, so a secret cannot change the structure of the
config.

```yaml
plugins:
    - name: "Trakt"
      configuration:
          ApiKey:
              _file: "/run/secrets/trakt-api-key" # contents, whitespace trimmed
          Endpoint: "https://${TRAKT_HOST}/api" # environment variable
```

- `{ _file: "<path>" }` is replaced by the file's contents with surrounding
  whitespace trimmed
- `${VAR}` is replaced by the environment variable, including inside a longer
  string, and in `_file` paths; `$${` is a literal `${`. Every other `$`
  (including `$$`) is left as written, so a password such as `pa$$word` is
  unchanged
- A missing file or an undefined variable fails the run
- Substituted values are always strings, so `${VAR}` cannot fill a numeric or
  boolean field

**Finding plugin configuration keys:**

To discover available configuration options for a plugin, you can query the
Jellyfin API:

```bash
# Get plugin ID
curl -s -H "X-Emby-Token: $API_KEY" \
  "http://localhost:8096/Plugins" | jq '.[] | select(.Name == "Trakt")'

# Get plugin configuration
curl -s -H "X-Emby-Token: $API_KEY" \
  "http://localhost:8096/Plugins/{pluginId}/Configuration"
```

---

## Authentication

`JELLARR_API_KEY` is the primary credential. Jellarr falls back to signing in by
name (`POST /Users/AuthenticateByName`) when the variable is unset, or when the
first authenticated call is answered with 401. The admin it signs in as is
`startup.user` when configured, otherwise the first entry of `users` whose
`policy.isAdministrator` is `true`, with that user's `password` or
`passwordFile`. It uses the returned access token for the rest of the run and
logs a warning that the fallback was used. With no API key and no such admin the
run fails.

## Startup Wait

Before its first API call Jellarr polls `GET /health` until Jellyfin answers
200, so a one-shot Job (for example a Kubernetes Job) can start alongside the
server. The wait defaults to 300 seconds and fails with a clear error when it
expires. Set it with `--waitTimeout <seconds>` or `JELLARR_WAIT_TIMEOUT`; the
flag wins.

```bash
JELLARR_WAIT_TIMEOUT=600 jellarr --configFile config.yml
```

## Dry Run

`jellarr --dry-run` (or `JELLARR_DRY_RUN=1`) prints what an apply would change
and changes nothing. It issues only GET requests and never signs in: it requires
`JELLARR_API_KEY`, and a rejected key or a missing one is an error, not a
fallback. It skips the first-boot wizard (reporting that it would run), plugin
installs and removals, the restart and the password probe (users are reported as
`password not verified (dry run)`). The client is wrapped so any write attempted
in dry-run throws.

Each section lists its planned changes as `path: current → desired`; users and
libraries to create, plugin installs and upgrades, and API keys are listed as
actions. Plugin configuration diffs are shown for installed plugins only. Values
that came from `_file` or `${VAR}` are printed as `***`, and are masked in every
log line, dry run or not.

| Exit code | Meaning              |
| --------- | -------------------- |
| 0         | nothing would change |
| 2         | changes are pending  |
| 1         | error                |

## Secret Management

### With sops-nix (nix only)

```nix
{
  sops = {
    secrets.jellarr-api-key.sopsFile = ./secrets/jellarr.env;
    templates.jellarr-env = {
      content = ''
        JELLARR_API_KEY=${config.sops.placeholder.jellarr-api-key}
      '';
      owner = config.services.jellarr.user;
      group = config.services.jellarr.group;
    };
  };

  services.jellarr = {
    enable = true;
    environmentFile = config.sops.templates.jellarr-env.path;
    config = { /* ... */ };
  };
}
```

### With Environment Variable

```bash
export JELLARR_API_KEY=your_api_key
jellarr
```

### With Docker

```bash
docker run -e JELLARR_API_KEY=your_api_key \
  -v ./config:/config:ro \
  ghcr.io/sini/jellarr:v0.3.0
```

### API Key Bootstrap (NixOS, Same Host Only)

For NixOS deployments where Jellarr runs on the **same host** as Jellyfin, you
can use the bootstrap feature to automatically provision the API key into
Jellyfin's database:

```nix
{
  sops.secrets.jellarr-api-key.sopsFile = ./secrets/jellarr-api-key;

  services.jellarr = {
    enable = true;
    config = {
      base_url = "http://localhost:8096";
      # ... your config ...
    };

    # Bootstrap: automatically inserts API key into Jellyfin's database
    bootstrap = {
      enable = true;
      apiKeyFile = config.sops.secrets.jellarr-api-key.path;
      # Optional settings (showing defaults):
      # apiKeyName = "jellarr";
      # jellyfinDataDir = "/var/lib/jellyfin";
          };
  };
}
```

**When you need it:** only if you have no other way to create the first API key.
Skip it when you provision the key yourself (Jellyfin UI, or a Jellyfin on
another host) and pass it through `environmentFile`.

**How it works:**

1. The `jellarr-api-key-bootstrap` service is pulled in by `jellarr.service`
   (`requiredBy` and `before`), so it runs only as part of a jellarr run and
   never blocks activation on its own
2. It waits for Jellyfin's database to exist and checks that the `ApiKeys` table
   has the columns Jellyfin 10.11 uses; on any other schema it exits non-zero
   without writing
3. If a key with this name already holds the configured value, it does nothing.
   Otherwise it stops Jellyfin, upserts the row by name (a rotated key replaces
   the old value instead of adding a row) and restarts Jellyfin

**Important notes:**

- This **only works when Jellarr and Jellyfin are on the same host** - it
  requires direct access to Jellyfin's database file
- The bootstrap service runs as `root` (required for stopping/starting Jellyfin
  and writing to the database)
- For deployments where Jellarr runs on a **different host** than Jellyfin, you
  must provision the API key manually (via Jellyfin's web UI or a separate
  script) and provide it via `environmentFile`

### NixOS module options

All options live under `services.jellarr`.

| Option                      | Default              | Meaning                                                                                                          |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `enable`                    | `false`              | Enable the service and timer                                                                                     |
| `package`                   | packaged jellarr     | Package whose binary runs                                                                                        |
| `config`                    | `null`               | Typed configuration; set exactly one of `config` and `configFile`                                                |
| `configFile`                | `null`               | Path to a YAML or JSON config used as is (share one settings set with another consumer)                          |
| `apiKeyFile`                | `null`               | API key file, delivered by systemd `LoadCredential` as `JELLARR_API_KEY_FILE`; do not also set `JELLARR_API_KEY` |
| `environmentFile`           | `null`               | systemd environment file (for `JELLARR_API_KEY` and `${VAR}` secrets)                                            |
| `jellyfinService`           | `"jellyfin.service"` | Unit jellarr runs after and wants; `null` when Jellyfin is elsewhere. Was `bootstrap.jellyfinService` (renamed)  |
| `waitTimeout`               | `300`                | Seconds to wait for Jellyfin `/health` (`JELLARR_WAIT_TIMEOUT`)                                                  |
| `schedule`                  | `"daily"`            | Timer `OnCalendar` for periodic runs                                                                             |
| `user` / `group`            | `"jellarr"`          | Service user and group                                                                                           |
| `dataDir`                   | `/var/lib/jellarr`   | Working directory; the config is installed to `config/config.yml`                                                |
| `bootstrap.enable`          | `false`              | Seed the API key into Jellyfin's database (same host only)                                                       |
| `bootstrap.apiKeyFile`      | `apiKeyFile`         | File with the key to seed                                                                                        |
| `bootstrap.apiKeyName`      | `"jellarr"`          | Name of the key row; the upsert key                                                                              |
| `bootstrap.jellyfinDataDir` | Jellyfin `dataDir`   | Directory holding `data/jellyfin.db`                                                                             |

Inside `config`, every string option also accepts `{ _file = "/path"; }`, which
jellarr reads at run time, so secrets stay out of the Nix store:

```nix
services.jellarr.config.networking.certificatePassword = {
  _file = "/run/secrets/cert-password";
};
```

### When the NixOS module runs

`jellarr.service` is a oneshot. It runs on the `services.jellarr.schedule` timer
and also at every `nixos-rebuild switch` (it is wanted by `multi-user.target`
and restarts when the rendered config changes), so a config change is applied
without waiting for the timer. The unit does not set `RemainAfterExit`, which
would stop the timer from running it again.

### Library `ignoreChanges` (NixOS)

Each entry of `services.jellarr.config.library.virtualFolders` accepts
`ignoreChanges`, a list of `libraryOptions` names (for example `"pathInfos"`)
that are applied only when the library is created:

```nix
services.jellarr.config.library.virtualFolders = [
  {
    name = "Anime";
    collectionType = "tvshows";
    libraryOptions.pathInfos = [{ path = "/data/anime"; }];
    ignoreChanges = [ "pathInfos" ];
  }
];
```

---

## Full Configuration Example

Full configuration example with VAAPI hardware acceleration:

```yaml
version: 1
base_url: "http://localhost:8096"
system:
    enableMetrics: true
    pluginRepositories:
        - name: "Jellyfin Official"
          url: "https://repo.jellyfin.org/releases/plugin/manifest.json"
          enabled: true
    trickplayOptions:
        enableHwAcceleration: true
        enableHwEncoding: true
encoding:
    enableHardwareEncoding: true
    hardwareAccelerationType: "vaapi"
    vaapiDevice: "/dev/dri/renderD128"
    hardwareDecodingCodecs:
        ["h264", "hevc", "mpeg2video", "vc1", "vp8", "vp9", "av1"]
    enableDecodingColorDepth10Hevc: true
    enableDecodingColorDepth10Vp9: true
    enableDecodingColorDepth10HevcRext: true
    enableDecodingColorDepth12HevcRext: true
    allowHevcEncoding: false
    allowAv1Encoding: false
library:
    virtualFolders:
        - name: "Movies"
          collectionType: "movies"
          libraryOptions:
              pathInfos:
                  - path: "/mnt/movies/English"
branding:
    loginDisclaimer: |
        Configured by <a href="https://github.com/venkyr77/jellarr">Jellarr</a>
    customCss: |
        @import url("https://cdn.jsdelivr.net/npm/jellyskin@latest/dist/main.css");
    splashscreenEnabled: false
users:
    - name: "regular-user"
      password: "secure-password"
    - name: "viewer-user"
      passwordFile: "/run/secrets/viewer-password"
    - name: "admin-user"
      passwordFile: "/run/secrets/admin-password"
      policy:
          isAdministrator: true
          loginAttemptsBeforeLockout: 3
          enabledLibraries:
              - "Movies"
              - "Shows"
plugins:
    - name: "Trakt"
      configuration:
          TraktUsers:
              - ExtraLogging: true
    - name: "Playback Reporting"
startup:
    completeStartupWizard: true
```

---

## Architecture

**Jellarr** is built in TypeScript with a strict pipeline pattern:

1. **CLI** (`src/cli/index.ts`) - Commander.js entry point
2. **Pipeline** (`src/pipeline/index.ts`) - Main orchestration:
   - Reads YAML config file
   - Validates with strict Zod schemas
   - Creates authenticated Jellyfin API client
   - Fetches current server configuration
   - Applies ONLY specified changes idempotently
3. **Apply Modules** (`src/apply/`) - Handle configuration updates per feature:
   - `calculateDiff()` - Pure calculation, returns schema or undefined
   - `apply()` - Side effects, calls Jellyfin API

**Key Design Principles:**

- **Selective updates:** Only modifies explicitly configured fields
- **Idempotent:** Safe to run multiple times
- **Type-safe:** OpenAPI-generated types + Zod validation
- **Calculate/Apply pattern:** Separation of pure logic from side effects
- **Comprehensive test coverage**

---

## Development

```bash
pnpm test        # Tests with Vitest
pnpm typecheck   # TypeScript validation
pnpm eslint      # Code linting
pnpm build       # Build with esbuild

# Full validation pipeline
npm run build && tsc --noEmit && pnpm eslint && pnpm test && nix fmt
```

### Nix Development

```bash
nix build .#default      # Build CLI package
nix build .#docker-image # Build Docker image
nix flake check          # Run checks
nix fmt                  # Format project files
```

---

## Comparison: Jellarr vs declarative-jellyfin

| Feature            | Jellarr                         | declarative-jellyfin                           |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| **Method**         | Official REST API               | Direct XML/DB manipulation                     |
| **Service Impact** | Zero (never stops Jellyfin)     | Stops/starts multiple times                    |
| **Platform**       | Cross-platform (Docker, any OS) | NixOS-only                                     |
| **Dependencies**   | Node.js 24+                     | systemd, sqlite, jellyfin running on same host |
| **Safety**         | API validates all changes       | Direct file/DB writes                          |
| **Future-proof**   | API contract stability          | Breaks on internal changes                     |
| **Type Safety**    | TypeScript + Zod + OpenAPI      | Bash scripts                                   |
| **Testing**        | Comprehensive unit tests        | Complex NixOS VM tests                         |

**declarative-jellyfin's approach:**

- Writes `~/.config/jellyfin/encoding.xml` directly
- Manipulates SQLite database with hardcoded schema
- Reimplements Jellyfin's UUID algorithm in bash
- Requires stopping Jellyfin service during configuration
- [Known issues with timing/conflicts](https://github.com/Sveske-Juice/declarative-jellyfin/issues/13)

**Jellarr's approach:**

- Uses `/System/Configuration` and similar API endpoints
- Never touches internal files or databases
- Jellyfin validates all changes
- Zero service interruption
- Works on any platform where Jellyfin runs

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[GNU AGPL-3.0 License](https://www.gnu.org/licenses/agpl-3.0.html)

© 2025 Jellarr contributors
