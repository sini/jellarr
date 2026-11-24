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

- **Jellyfin 10.11 and 12.** The API types are generated from Jellyfin 12, and a
  setting the connected server doesn't support is skipped with a warning rather
  than re-applied on every run, so one config works against both.
- **`--dry-run`**: strictly read-only, prints `path: current → desired` for
  every pending change, masks secrets, and exits 0 / 2 / 1 for no change /
  changes pending / error, so it can gate CI or a deploy.
- **Optional authoritative mode** for users, libraries, plugins and API keys:
  remove what the config doesn't declare, with rails that protect the signed-in
  user, the active key and the last administrator, a `keep` list, and a refusal
  to remove more than half of anything without `allowMassDelete`.
- **User sync for SSO-created accounts:** scope authoritative users to an
  authentication provider, disable users who are no longer kept instead of
  deleting them, re-enable them if they come back, and optionally delete them
  after a grace period (`deleteDisabledAfter`).
- **More of Jellyfin's settings:** every settable user policy and preference,
  Live TV tuners and guide providers, scheduled task triggers, metadata options
  and path substitutions, splashscreen upload and removal, and library folders
  kept in step with the declared paths (stale or duplicate `.mblink` links are
  cleaned up).
- **Plugins:** matched by catalog GUID, pinned or kept up to date, chosen from a
  specific repository when you want, restarted in the same run after an install,
  and configured once they are Active.
- **Secrets** from files (`{ _file: path }`) or the environment (`${VAR}`)
  anywhere in the config, resolved after parsing so a secret can't change the
  config's structure.
- **Authentication** falls back to signing in as the admin when no API key is
  set or the key is rejected; the key can also come from `JELLARR_API_KEY_FILE`.
  `passwordFile` is reconciled for existing users without risking lockout.
- **Startup that waits properly** for a Jellyfin that is still starting or
  migrating its database, so a deploy that restarts Jellyfin doesn't fail.
- **Every module is tested to change nothing** on a second run with the same
  config, and a declared list always replaces the server's list.
- **NixOS module:** ordered after Jellyfin, runs at boot and after a switch that
  changes the config or the package without making either wait, takes
  `apiKeyFile` through systemd credentials, accepts `{ _file = ...; }` wherever
  it accepts a string, and can take a plain `configFile`.
- **Container image** with jellarr as its entrypoint, running as an unprivileged
  user, ready for a Kubernetes Job.
- **A migration guide from declarative-jellyfin**:
  [docs/migrating-from-declarative-jellyfin.md](docs/migrating-from-declarative-jellyfin.md).

Coming from upstream v0.1.1? Read [CHANGELOG.md](CHANGELOG.md) first. A few
behaviours changed, most notably that strings containing `${NAME}` are now
expanded from the environment (write `$${` for a literal `${`).

Releases start at v0.3.0. Another fork has already published 0.2.x, and skipping
it keeps the two from being confused.

Commits taken from other forks are cherry-picked with their original author.
Where a change had to be rewritten, the commit carries `Co-authored-by` and
`Adapted-from` trailers that point at the source. If you maintain a fork with
work that isn't here, pull requests are welcome; bugs and ideas go in
[issues](https://github.com/sini/jellarr/issues), and we'd rather converge than
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
nix run github:sini/jellarr/v0.5.0

# With Docker
docker pull ghcr.io/sini/jellarr:v0.5.0

# Download binary (requires Node.js 24+)
node jellarr-v0.5.0.cjs --configFile path/to/config.yml
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
JELLARR_API_KEY=your_api_key nix run github:sini/jellarr/v0.5.0
```

Coming from declarative-jellyfin? See the
[migration guide](./docs/migrating-from-declarative-jellyfin.md).

### Docker (Recommended)

```bash
docker pull ghcr.io/sini/jellarr:v0.5.0
```

**With docker-compose:**

```yaml
services:
    jellarr:
        image: ghcr.io/sini/jellarr:v0.5.0
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
curl -LO https://github.com/sini/jellarr/releases/download/v0.5.0/jellarr-v0.5.0.cjs
JELLARR_API_KEY=your_api_key node jellarr-v0.5.0.cjs --configFile path/to/config.yml
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

### Jellyfin versions

Jellarr works against Jellyfin 10.11 and 12 (its API types are generated from
the 12.4.0 OpenAPI spec). A field the connected server does not have is skipped
with a warning, not sent: jellarr reads the server's own API description
(`/api-docs/openapi.json`) and, for a declared field its schema does not define,
logs `<path> is not supported by Jellyfin <version>; skipped` once per run and
leaves it out of the diff and the write. A setting that only exists in 12
therefore never reads as drift on 10.11, and a setting 12 removed is still
applied on 10.11. If the description cannot be read, jellarr says so and skips
nothing. The settings that need Jellyfin 12 are marked below.

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
    metadataOptions: # per item type
        - itemType: "Movie"
          disabledMetadataSavers: ["Nfo"]
          imageFetcherOrder: ["TheMovieDb"]
    contentTypes:
        - name: "/media/movies"
          value: "movies"
    pathSubstitutions:
        - from: "/data"
          to: "/mnt/data"
    castReceiverApplications:
        - id: "ABC123"
          name: "Stable"
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

`metadataOptions`, `contentTypes`, `pathSubstitutions` and
`castReceiverApplications` are arrays of objects. A declared list is
authoritative: it replaces the server's list whole, and `[]` clears it. Fields
the server adds to an element, or that a declared element leaves out, keep the
server's value, so a second run changes nothing.

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
    subtitleExtractionTimeoutMinutes: 5 # Jellyfin 12 and later
    allowOnDemandMetadataBasedKeyframeExtractionForExtensions:
        - mkv
    # HLS seeking
    hlsAudioSeekStrategy: "TrimCopiedAudio" # TrimCopiedAudio|TranscodeAudio, Jellyfin 12 and later
```

The full field set mirrors Jellyfin's `EncodingOptions` object.
`subtitleExtractionTimeoutMinutes` and `hlsAudioSeekStrategy` exist only in
Jellyfin 12; on 10.11 they are skipped with a warning.

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

The full field set mirrors Jellyfin's `LibraryOptions` object. Each entry of
`typeOptions` also takes `similarItemProviders` and `similarItemProviderOrder`
(lists of provider names, Jellyfin 12 and later; skipped with a warning on
10.11). In the NixOS module `similarItemProviderOrder` defaults to
`similarItemProviders` when that is set, as the fetcher orders do.

**Locations.** Jellyfin scans a library's `.mblink` shortcut files (reported as
`Locations`), not `PathInfos`, and the two can disagree: a stale shortcut, or
the same folder linked twice. For every existing library that declares
`pathInfos` (and does not list `pathInfos` in `ignoreChanges`), jellarr makes
the shortcuts match: it links missing paths, unlinks paths that are not declared
and collapses a folder linked more than once into one link. **Unlinking is
destructive:** the items under that location leave the library on its next scan.
A dry run prints each link, unlink and collapse. Jellarr does not trigger a
library scan for this (as with a library options update); the server picks the
change up on its next scan.

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

`splashscreenFile` is a plain path to an image (it does not take `{ _file }`
references). Jellarr uploads it with `POST /Branding/Splashscreen`, but only
when its bytes differ from what `GET /Branding/Splashscreen` serves: the server
returns the stored custom image unchanged, so a byte comparison is the
idempotence signal. A dry run reports the planned upload.

```yaml
branding:
    splashscreenFile: /etc/jellarr/splash.png
```

`removeSplashscreen: true` deletes the custom splashscreen with
`DELETE /Branding/Splashscreen`. Jellyfin serves the custom image only while
`splashscreenEnabled` is true and answers 404 otherwise, so jellarr removes it
only when the splashscreen is enabled (declared, or already on the server) and
`GET /Branding/Splashscreen` returns an image; when it is disabled, or nothing
is set, it does nothing, and a second run is a no-op. To remove an image from a
disabled splashscreen, declare `splashscreenEnabled: true` with it. A dry run
reports the removal. It cannot be combined with `splashscreenFile`.

```yaml
branding:
    splashscreenEnabled: true
    removeSplashscreen: true
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

Every settable field of Jellyfin's `UserPolicy` (41) and `UserConfiguration`
(16) is available under `policy` and at the top level of the user. Not exposed,
because the server manages them: `AuthenticationProviderId`,
`PasswordResetProviderId` and `InvalidLoginAttemptCount`. Declared lists are
authoritative and `[]` clears them. Fields that hold library IDs take library
names: `policy.enabledLibraries`, `policy.enableContentDeletionFromLibraries`,
`policy.blockedMediaLibraries`, `orderedLibraries`, `groupedLibraries`,
`latestItemsExcludedLibraries` and `myMediaExcludedLibraries`.
`policy.accessSchedules` takes `dayOfWeek` (a day, `Everyday`, `Weekday` or
`Weekend`), `startHour` and `endHour`; `policy.syncPlayAccess` is
`CreateAndJoinGroups`, `JoinGroups` or `None`.

`policy.maxParentalRating` and `policy.maxParentalSubRating` can be cleared: an
explicit `null` removes the limit on the server, while an absent key leaves it
unmanaged. In the NixOS module `null` means unset, so use `"unrestricted"` for
the same effect.

```yaml
users:
    - name: "kid"
      password: "pw"
      policy:
          maxParentalRating: 7 # set the limit
    - name: "adult"
      password: "pw"
      policy:
          maxParentalRating: null # clear it
```

```nix
services.jellarr.config.users = [
  { name = "adult"; passwordFile = "/run/secrets/adult"; policy.maxParentalRating = "unrestricted"; }
];
```

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
an array you omit is left alone, and `[]` clears one. That includes
`policy.enabledLibraries: []`, which removes all library access unless
`enableAllFolders` is true.

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
        enableAutomaticPortMapping: false # not sent to Jellyfin 12, which dropped it
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
additive and idempotent: existing keys are never modified, and are deleted only
if you opt in with [`authoritative.apiKeys`](#authoritative-mode).

**Caveat:** calling `/Auth/Keys` needs an existing token, so this only adds
keys. Provision the first credential via the API-key bootstrap or the Jellyfin
dashboard.

### Live TV Configuration

```yaml
version: 1
base_url: "http://localhost:8096"
livetv:
    guideDays: 7
    recordingPath: /srv/recordings
    saveRecordingNfo: true
    authoritative: false
    tunerHosts:
        - type: m3u
          url: "http://tv.example/playlist.m3u"
          tunerCount: 2
    listingProviders:
        - type: SchedulesDirect
          username: me
          listingsId: "USA-00000-X"
          password: { _file: /run/secrets/schedules-direct }
        - type: xmltv
          path: /srv/guide.xml
          enableAllTuners: true
```

The scalar options are the named `livetv` configuration (`LiveTvOptions`),
diffed like the other modules. Tuner hosts (`POST /LiveTv/TunerHosts`) and
listings providers (`POST /LiveTv/ListingProviders`) are lists the server only
exposes as part of that configuration, so jellarr matches entries by identity:

- a tuner host is `type` plus `url`;
- a listings provider is `type` plus `path`, `username` and `listingsId`
  (whichever it has).

A missing entry is created, an entry whose fields differ is updated in place
(keeping its server id), and a matching entry is left alone. Lists are
**additive by default**: entries on the server that the config does not declare
are kept. Set `authoritative: true` to delete them; it only applies to a list
the config declares, so `tunerHosts: []` with `authoritative: true` removes
every tuner host, while leaving `tunerHosts` out never touches them. Changing an
identity field creates a new entry, and with `authoritative` the old one is
removed.

A listings `password` is plain text (use `{ _file }` or `${VAR}`; it is masked
in dry-run output). The server stores only a SHA-1 hash of it and takes the
plain text as the `pw` query parameter, so jellarr compares the hash and sends
the password only when it differs. Providers are saved without the server
validating the login or the guide. `MediaLocationsCreated` is server state and
is not configurable. `jellarr dump` exports the section without passwords.

`authoritative.livetv` is accepted as an alias of `livetv.authoritative`. The
canonical form is `livetv.authoritative`; set only one of them (the two
disagreeing is a validation error). The alias has no effect without a `livetv`
section.

### Authoritative Mode

By default jellarr **never deletes** users, libraries, plugins or API keys:
removing an entry from the config just stops managing it. Authoritative mode is
the opt-in that makes the config the whole truth for a kind, so entries the
config does not declare are deleted.

```yaml
version: 1
base_url: "http://localhost:8096"
authoritative:
    users: delete # true or "delete": DELETE /Users/{id}; "disable": IsDisabled = true
    libraries: true # DELETE /Library/VirtualFolders?name=…
    plugins: true # uninstall, removable plugins only
    apiKeys: true # DELETE /Auth/Keys/{key}
    livetv: false # alias of livetv.authoritative
    keep:
        users: [guest]
        libraries: ["Home Videos"]
        plugins: ["Some Plugin"]
        apiKeys: [monitoring]
    allowMassDelete: false
    deleteDisabledAfter: 30d # only with users: disable
```

Every flag is `false` by default. **Deletions are permanent and jellarr keeps no
backup**, so run `--dry-run` first: each deletion is a plan line that starts
with `DESTRUCTIVE`, and a dry run never calls a DELETE.

- **Users.** `DELETE /Users/{id}`. A deleted user's **watch history, playback
  progress and per-user data are lost**, and the plan line says so. A user is
  matched by name, ignoring case. Users declared in `users` (or `startup.user`)
  are not touched. `users: "disable"` is the gentler mode, described below.
- **Libraries.** `DELETE /Library/VirtualFolders?name=…`. Files on disk stay,
  but the library's items and their watch state leave the Jellyfin database.
  Library deletions run after the Locations reconciliation.
- **Plugins.** Uninstalls only plugins the server reports as removable
  (`CanUninstall`); bundled plugins are never considered. Jellyfin restarts to
  unload them. Declared plugins are matched as for `plugins`.
- **API keys.** `DELETE /Auth/Keys/{key}`, matched by `AppName`. Session tokens
  are not API keys and are never listed.

Deletions run after every create and update, so a rename (delete the old entry,
declare the new one) never leaves a gap. All deletions are worked out before any
is made, so a refused safety rail leaves the server untouched.

**Safety rails**, always on:

- jellarr never deletes the user it is signed in as, or authenticated through
  (the admin it falls back to when `JELLARR_API_KEY` is unset or rejected).
- It never deletes the API key it is using (`JELLARR_API_KEY`).
- It never deletes the last administrator: if no administrator would remain
  after the deletions, the run fails. A declared `policy.isAdministrator`
  counts.
- `authoritative.keep` spares entries by name, per kind.
- If a run would delete more than half of the entries of a kind, it refuses with
  an error, unless `authoritative.allowMassDelete: true`. A typo, or an empty
  `library.virtualFolders: []`, then cannot wipe a server. A kind whose section
  is missing from the config counts as an empty list. For plugins the count is
  of removable plugins only.

#### Disabling users instead of deleting them

`authoritative.users: "disable"` sets `Policy.IsDisabled = true` on every user
the config does not declare or keep, through the user policy write. The account
and its watch history stay. The candidates and the rails are those of deletion:
never the signed-in user, never the last enabled administrator, never
`keep.users` or declared users, and the mass rail counts disables and deletes
together against the number of users, so disabling most of a server also needs
`allowMassDelete: true`.

Jellyfin does not say since when a user is disabled, so jellarr records it in
the user's display preferences on the server:
`POST /DisplayPreferences/jellarr?userId=…&client=jellarr` with
`CustomPrefs["jellarr.disabledAt"]` set to an ISO-8601 UTC timestamp from
jellarr's clock. The marker lives in Jellyfin's database, so it survives
stateless runs (a Kubernetes Job with a read-only root filesystem) and goes with
the user. A user that is already disabled but has no marker (someone else
disabled it) gets one at jellarr's first sight, so its grace period starts then.

- **Re-enable.** A user that carries a jellarr marker and is declared or in
  `keep.users` again is re-enabled and loses the marker. A disabled user without
  a marker is never re-enabled: an administrator's own disable wins.
- **Delete after.** `authoritative.deleteDisabledAfter: 30d` (units `w`, `d`,
  `h`, `m`, `s`; valid only with `users: "disable"`) deletes a user whose marker
  is older than that, through the same deletion path and rails. Unset means
  never. A marker exactly that old is already due (the comparison is inclusive).
  A marker jellarr cannot parse is logged and rewritten with the current time,
  and the user is not deleted on that run.

Dry-run lines:
`would disable user X (not declared or kept); deletion after
<date>` (or
`never deleted`), `would re-enable user X (kept again)` and
`DESTRUCTIVE would delete user X (disabled by jellarr since <date>)`.

For users created by an SSO plugin on first login, this keeps the server in step
with who is allowed in:

```yaml
authoritative:
    users: disable
    deleteDisabledAfter: 30d
    keep:
        users: [admin] # accounts the plugin does not manage
users:
    - name: admin
      password: ...
      policy:
          isAdministrator: true
```

Someone who loses access is disabled on the next run, re-enabled if they regain
it, and deleted after 30 days if they do not.

**Scoping to one authentication provider.** Set
`authoritative.usersScope.authenticationProviderId` to an id, or a list of ids,
and only users whose `Policy.AuthenticationProviderId` is listed are candidates
for disabling, re-enabling or deleting, in every mode. Other users are out of
scope: never touched, and not counted by the mass rail, whose denominator is the
number of users in scope. Unset means every user is in scope. To manage only the
accounts an SSO plugin creates, use the provider id that plugin sets (see
`Policy.AuthenticationProviderId` in `GET /Users`):

```yaml
authoritative:
    users: disable
    usersScope:
        authenticationProviderId: "<the provider id your SSO plugin sets>"
```

### Scheduled Tasks

```yaml
version: 1
base_url: "http://localhost:8096"
scheduledTasks:
    - key: RefreshLibrary # the task's stable Key; preferred
      triggers:
          - type: DailyTrigger
            timeOfDay: "03:30"
            maxRuntime: 2h
          - type: IntervalTrigger
            interval: 6h
    - name: Clean Cache Directory # matched by name when no key is given
      triggers: []
    - key: PluginUpdates
      triggers:
          - type: WeeklyTrigger
            dayOfWeek: Sunday
            timeOfDay: "04:00"
          - type: StartupTrigger
```

A task is matched by its `Key` (preferred; `jellarr dump` lists the keys), or
else by its display `name`. A declared task's trigger list is **authoritative**:
it replaces the server's list with `POST /ScheduledTasks/{taskId}/Triggers`, and
`triggers: []` clears it. Tasks you do not declare are not touched. An unknown
key or name is an error that lists the valid keys.

Triggers follow Jellyfin's `TaskTriggerInfo`:

| `type`            | needs                       | form                                          |
| ----------------- | --------------------------- | --------------------------------------------- |
| `DailyTrigger`    | a time of day               | `timeOfDay: "03:30"` or `timeOfDayTicks`      |
| `WeeklyTrigger`   | a time of day and a weekday | the above plus `dayOfWeek: Sunday`…`Saturday` |
| `IntervalTrigger` | an interval                 | `interval: 6h` or `intervalTicks`             |
| `StartupTrigger`  | nothing                     |                                               |

Every type also takes `maxRuntime: 2h` or `maxRuntimeTicks`. The friendly forms
are converted to .NET ticks (100 ns; one second is `10000000`): `timeOfDay` is
`HH:MM` or `HH:MM:SS`, and a duration is a run of `<n>d`, `<n>h`, `<n>m` and
`<n>s` such as `90m` or `1h30m`. Give either the friendly form or the ticks for
a field, not both; the dump uses ticks. Triggers are compared normalised (server
nulls and fields a type does not use are ignored, and order does not matter), so
two runs with the same config change nothing.

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

    # Take one plugin from a named repository; the others use any repository
    - name: "Fanart"
      repository: "Dev"
```

**How it works:**

- Plugins are installed from repositories configured in
  `system.pluginRepositories`
- Plugin names must match the catalog name exactly (case-sensitive). Installed
  plugins are matched by the catalog entry's GUID, so a plugin that reports a
  different name once installed (e.g. "SSO Authentication" installs as
  "SSO-Auth") is still recognized
- When several repositories list the same plugin, Jellyfin merges them (by GUID,
  else name) and every version from every repository is a candidate, each
  installed from the repository it came from. `repository` names an entry of
  `system.pluginRepositories` and restricts the plugin to that repository's
  versions; an undeclared name is a configuration error
- Without `version`, each plugin is kept at the newest version its repositories
  offer for the running Jellyfin version, so changing a repository URL or
  upgrading Jellyfin upgrades the plugin on the next run
- With `version`, that version is installed and the plugin is held there.
  Jellyfin always loads the newest installed copy of a plugin, so a pin below
  the installed version is reported but not applied; uninstall the plugin to
  downgrade. A pin equal to the installed version does nothing even when no
  repository offers it any more, and an unavailable pin on an installed plugin
  is warned about and left alone (it is an error only when the plugin is not
  installed)
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
- Path-valued `*File` options (`passwordFile`) take a plain path, and `${VAR}`
  is allowed in it (`${CREDENTIALS_DIRECTORY}/admin`); `{ _file: ... }` there is
  an error, because it would use the file's contents as a path. The NixOS module
  types `passwordFile` as a plain string for the same reason
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

The same timeout bounds how long any request that Jellyfin answers with 503 is
retried. A major Jellyfin upgrade can run a long database migration at first
start, during which `/health` is 200 but every authenticated request is 503, so
set the timeout to cover it.

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
  ghcr.io/sini/jellarr:v0.5.0 --configFile /config/config.yml
```

The image's entrypoint is jellarr itself and it runs as user `65534`, so
anything after the image name is passed to jellarr (`--dry-run`,
`--waitTimeout 1800`, `dump --baseUrl …`). In a Kubernetes Job, set `args:` and
leave `command:` unset:

```yaml
containers:
    - name: jellarr
      image: ghcr.io/sini/jellarr:v0.5.0
      args: ["--configFile", "/config/config.yml"]
      env:
          - name: JELLARR_API_KEY_FILE
            value: /secrets/api-key
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

**Several keys:**
`bootstrap.extraKeys = { "my-app" = "/run/secrets/my-app-key"; };` seeds more
keys with values you choose, which the API cannot do, so applications that
already hold a key keep it after a migration. Every key is checked and upserted
by name the same way, and Jellyfin is stopped and restarted once for all of
them. A key file that is empty or holds characters outside `A-Za-z0-9._~+/=-`
fails the service, as does a name outside letters, digits, `.`, `_`, `-` and
spaces or one equal to `apiKeyName`. The CLI's `api_keys` list stays
create-only.

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
| `bootstrap.extraKeys`       | `{}`                 | More keys to seed, `{ <name> = <file>; }`, upserted by name with the same checks                                 |
| `bootstrap.jellyfinDataDir` | Jellyfin `dataDir`   | Directory holding `data/jellyfin.db`                                                                             |

Inside `config`, every string option also accepts `{ _file = "/path"; }`, which
jellarr reads at run time, so secrets stay out of the Nix store:

```nix
services.jellarr.config.networking.certificatePassword = {
  _file = "/run/secrets/cert-password";
};
```

### When the NixOS module runs

`jellarr.service` is a oneshot ordered after and wanting `jellyfinService`; the
CLI itself waits for Jellyfin to be healthy. It runs from two timers:
`jellarr.timer` (`services.jellarr.schedule`) and `jellarr-apply.timer`, which
fires when it activates, so at boot and after a `nixos-rebuild switch` that
changed the rendered config or the jellarr package. The trigger restarts
`jellarr.service`, so a run still going from before the switch is replaced by
one of the new package. Neither boot nor switch waits for the run to finish. The
unit does not set `RemainAfterExit`, which would stop the timers from running it
again.

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

| Feature            | Jellarr                                                       | declarative-jellyfin                           |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------- |
| **Method**         | Official REST API                                             | Direct XML/DB manipulation                     |
| **Service Impact** | Restarts only to load or unload plugins                       | Stops/starts multiple times                    |
| **Platform**       | Cross-platform (Docker, any OS)                               | NixOS-only                                     |
| **Dependencies**   | Node.js 24+                                                   | systemd, sqlite, jellyfin running on same host |
| **Safety**         | API validates all changes                                     | Direct file/DB writes                          |
| **Future-proof**   | API contract stability                                        | Breaks on internal changes                     |
| **Type Safety**    | TypeScript + Zod + OpenAPI                                    | Bash scripts                                   |
| **Testing**        | Unit tests, plus NixOS VM tests against Jellyfin 10.11 and 12 | NixOS VM tests                                 |

**declarative-jellyfin's approach:**

- Writes `~/.config/jellyfin/encoding.xml` directly
- Manipulates SQLite database with hardcoded schema
- Reimplements Jellyfin's UUID algorithm in bash
- Requires stopping Jellyfin service during configuration
- [Known issues with timing/conflicts](https://github.com/Sveske-Juice/declarative-jellyfin/issues/13)

**Jellarr's approach:**

- Uses `/System/Configuration` and similar API endpoints
- Never touches internal files or databases, except the optional NixOS
  `bootstrap`, which seeds an API key into the database before Jellyfin starts
- Jellyfin validates all changes
- No service interruption, except the restart Jellyfin needs to load or unload a
  plugin
- Works on any platform where Jellyfin runs

---

## Contributing

Contributions are welcome. Open an
[issue](https://github.com/sini/jellarr/issues) for bugs and ideas, or a pull
request against `main`. Run `nix fmt` before committing, and keep
`pnpm typecheck`, `pnpm eslint` and `pnpm test` clean; CI also runs the NixOS VM
tests.

---

## License

[GNU AGPL-3.0 License](https://www.gnu.org/licenses/agpl-3.0.html)

© 2025 Jellarr contributors
