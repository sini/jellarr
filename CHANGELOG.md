# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-11-24

### Added

- `CONTRIBUTING.md`: how to build, the checks, commit conventions, credit
  trailers for adapted work, and where to open issues.
- README: running the container from an external scheduler (cron, a systemd
  timer, a Kubernetes CronJob), and a note that the image is built with nix
  `dockerTools`.
- Jellyfin settings that are read only at startup (`baseUrl`, `enableHttps`,
  `requireHttps`, `certificatePath`, `certificatePassword`, `internalHttpPort`,
  `internalHttpsPort`, `enableIPv4`, `enableIPv6`, `localNetworkAddresses`,
  `ignoreVirtualInterfaces`, `virtualInterfaceNames`, `knownProxies`) now make
  jellarr restart Jellyfin once at the end of the run and wait for it. Dry-run
  reports `would restart Jellyfin to apply <fields>`. After a `baseUrl` change
  the server cannot be restarted over the API, so jellarr writes it last, warns,
  and leaves the restart to you.

- `plugins[].enabled` enables or disables an installed plugin
  (`POST /Plugins/{id}/{version}/Enable` and `/Disable`). Jellyfin applies the
  change after a restart, which jellarr performs in the same run. The
  configuration of a plugin declared `enabled: false` is not applied, since a
  disabled plugin is not loaded. `--dump` writes `enabled: false` for a disabled
  plugin.
- `xbmcMetadata` manages the `xbmcmetadata` named configuration (NFO saving
  options): `userId`, `releaseDateFormat`, `saveImagePathsInNfo`,
  `enablePathSubstitution` and `enableExtraThumbsDuplication`. It is read by
  `--dump`, planned by `--dry-run`, and available in the NixOS module.
- `users[].displayPreferences` pins per-user display preferences, matched by
  `(id, client)` (`id` defaults to `usersettings`). Declared fields and
  `customPrefs` keys are merged into the stored entry; undeclared ones are kept.
  The `jellarr` entry that holds jellarr's own markers cannot be declared.
- `library.virtualFolders[].renameFrom` renames a library
  (`POST /Library/VirtualFolders/Name`) when the old name exists and the new one
  does not, then reconciles it as usual. It does nothing once the rename
  happened, and is an error when both names exist.
- `users[].renameFrom` renames a user (`POST /Users`) with the same rules,
  keeping the account, its history and its policy. A renamed administrator still
  signs in when no API key is set: the sign-in tries the declared name, then
  `renameFrom`.
- `users[].policy.authenticationProviderId` and `passwordResetProviderId` set a
  user's providers. An id the server does not report (`GET /Auth/Providers`,
  `GET /Auth/PasswordResetProviders`) is an error before anything is written,
  because a wrong provider can lock a user out; the README says so.
- `library.virtualFolders[].libraryOptions.typeOptions[].imageOptions` sets the
  per-image-type limit and minimum width. A declared list replaces the server's;
  an undeclared one is carried over unchanged.

### Changed

- The networking section is written after every other section.

### Fixed

- The NixOS module always emits `system`, which the runtime schema requires
  (upstream #81).
- `hardwareDecodingCodecs` accepts `mpeg1video` and `mpeg4`, the codecs the
  Jellyfin dashboard offers (upstream #78).
- `loginAttemptsBeforeLockout` accepts `-1` (never lock out) and `0` (server
  default), and `maxActiveSessions` accepts `0` (unlimited), so a `dump` of an
  ordinary server validates (upstream #78).
- `services.jellarr.package` defaults to the flake's own build, so a consumer's
  nixpkgs, such as nixos-25.11, cannot break it (upstream #65).

## [0.5.0] - 2026-11-23

### Added

- `authoritative.users: "disable"` disables the users the config does not
  declare (`Policy.IsDisabled = true`) instead of deleting them, so the account
  and its watch history stay. `true` and `"delete"` still delete. The rails are
  the deletion rails: never the signed-in user or the last enabled
  administrator, `keep.users` and declared users are spared, and
  `allowMassDelete` is needed when disabling and deleting together would touch
  more than half the users.
- jellarr records when it disabled a user in that user's Jellyfin display
  preferences (`GET`/`POST /DisplayPreferences/jellarr`, `CustomPrefs` key
  `jellarr.disabledAt`, UTC), so the record survives stateless runs and goes
  with the user. A user someone else already disabled gets the marker at
  jellarr's first sight.
- A user that carries a jellarr marker and is kept again (declared or in
  `keep.users`) is re-enabled and loses the marker. A disabled user without a
  marker is never re-enabled.
- `authoritative.deleteDisabledAfter` (`30d`, `12h`, `2w`), valid only with
  `users: "disable"`, deletes a user whose jellarr marker is older than that.
  Unset means never. Durations now also accept a `w` unit.
- The NixOS module mirrors both options, and the `jellarr-authority` VM test
  covers disable, re-enable, delete-after and a no-op second run.

## [0.4.0] - 2026-11-23

### Added

- Settings new in Jellyfin 12: `encoding.subtitleExtractionTimeoutMinutes`,
  `encoding.hlsAudioSeekStrategy`, and `similarItemProviders` /
  `similarItemProviderOrder` on each library `typeOptions` entry. They are in
  the YAML schema, the NixOS module and `jellarr dump`.
- `branding.removeSplashscreen: true` deletes the custom splashscreen with
  `DELETE /Branding/Splashscreen`. It acts only while the splashscreen is
  enabled and the server returns an image, so a second run does nothing. A dry
  run reports it, and it cannot be combined with `splashscreenFile`.
- `policy.maxParentalRating` and `policy.maxParentalSubRating` can be cleared
  with an explicit `null`; an absent key is still unmanaged. In the NixOS module
  the value `"unrestricted"` renders as that `null`.

- Opt-in authoritative mode. `authoritative.users`, `authoritative.libraries`,
  `authoritative.plugins` and `authoritative.apiKeys` delete the entries the
  config does not declare, after every create and update. All are off by
  default, and **deletions are permanent**: a deleted user loses their watch
  history, so run `--dry-run` first (each deletion is a `DESTRUCTIVE` plan
  line). jellarr never deletes the user it is signed in as, the API key it is
  using or the last administrator; `authoritative.keep` spares entries by name;
  and a run that would delete more than half of a kind is refused unless
  `authoritative.allowMassDelete` is set. Plugins are limited to those the
  server reports as removable. `authoritative.livetv` is an alias of
  `livetv.authoritative`. The NixOS module mirrors the options.
- `scheduledTasks` sets a task's triggers (`DailyTrigger`, `WeeklyTrigger`,
  `IntervalTrigger`, `StartupTrigger`), matched by the task's `Key` or its name.
  A declared task's trigger list replaces the server's; other tasks are left
  alone. Besides Jellyfin's ticks, `timeOfDay: "03:30"`, `interval: 6h` and
  `maxRuntime: 2h` are accepted. `jellarr dump` exports every task's triggers.
- The `jellarr-authority` VM test, on Jellyfin 10.11 and 12.

### Changed

- The API types are regenerated from the Jellyfin 12.4.0 OpenAPI spec. jellarr
  still works against Jellyfin 10.11.
- A declared field the connected server's own API description
  (`/api-docs/openapi.json`) does not define is skipped with a warning
  (`<path> is not supported by Jellyfin <version>; skipped`) and left out of the
  diff and the write, so a 12-only setting on 10.11, or a setting 12 removed, no
  longer shows as a change on every run. This covers the system, encoding,
  networking, metadata, branding, library, live TV and user settings.
- A declared `null` over a field the server omits counts as already in place,
  since Jellyfin leaves null fields out of what it returns.
- The startup wizard no longer sends `remoteAccess.enableAutomaticPortMapping`
  to Jellyfin 12, which removed it; it is skipped with a warning there and still
  sent to 10.11.

## [0.3.5] - 2026-11-22

### Changed

- The container image runs jellarr as its entrypoint, with no default command,
  so `docker run ghcr.io/sini/jellarr:v0.3.5 --configFile /config/config.yml`
  and a Kubernetes `args:` list pass flags to jellarr. Before, the binary was
  the image's only `Cmd`, so any arguments replaced it. A Kubernetes Job that
  set `command:` to the old store path should drop `command:` and keep `args:`.
- The image runs as `65534:65534` (nobody) instead of root.

## [0.3.4] - 2026-11-21

### Changed

- Plugin install and upgrade log lines name the repository the version comes
  from, for example `Installing plugin: Example 1.0.0 from Stable (https://…)`,
  so a per-plugin `repository` choice can be checked from the log.

### Fixed

- A Jellyfin that is still starting up no longer fails the run. While a long
  start-up task such as a major-version database migration runs, Jellyfin
  answers `/health` with 200 but every authenticated request with 503. Jellarr
  now retries a 503 on any request, with a growing delay, until the wait timeout
  (`--waitTimeout` / `JELLARR_WAIT_TIMEOUT`, default 300s) runs out, then fails
  with a message saying so. Other errors are not retried.

## [0.3.3] - 2026-11-21

### Fixed

- A plugin pinned to a version that is already installed no longer fails the run
  when the repositories stop offering that version. An unavailable pin on an
  installed plugin is warned about and left as is; it is an error only when the
  plugin is not installed.
- Versions of one plugin from several repositories are all candidates, each
  installed from its own repository, instead of only the first catalog entry's.

### Added

- `repository` on a plugin entry (and the NixOS module's plugin option) takes a
  name from `system.pluginRepositories` and restricts that plugin to the
  versions that repository offers. An undeclared name is a validation error.

## [0.3.2] - 2026-11-21

### Fixed

- The NixOS module applies after a switch that changes only the jellarr package,
  not just the config. The switch-time trigger now restarts `jellarr.service`
  instead of starting it, so a run that was still going from before the switch
  (on the old package) is replaced by a run of the new one.

## [0.3.1] - 2026-11-21

### Fixed

- Library locations are reconciled with `pathInfos`: jellarr links missing
  paths, unlinks undeclared ones (their items leave the library on the next
  scan) and collapses a folder linked twice, where it previously reported "up to
  date" while Jellyfin scanned stale `.mblink` shortcuts. Skipped for a library
  that lists `pathInfos` in `ignoreChanges`.
- The startup wait now requires `/System/Info/Public` to return 200, not just
  "not 503". While Jellyfin is still loading its configuration it can answer
  `/health` and then return 500 to API calls, which failed the first run after a
  `nixos-rebuild switch` that restarted Jellyfin.

## [0.3.0] - 2026-11-21

The first release of this community fork at
[sini/jellarr](https://github.com/sini/jellarr). It carries upstream's
unreleased v0.1.1 branch, the open upstream pull requests and work from other
forks; the README lists who contributed what. Version 0.2.x is skipped because
another fork has already published it.

### Breaking changes

- Strings anywhere in the config containing `${NAME}` are expanded from the
  environment; an undefined variable fails the run. Write `$${` for a literal
  `${`. Other `$` characters are left alone.
- A declared list replaces the server's list in every module, so removing an
  entry from the config removes it from Jellyfin, and `[]` clears it. That
  includes `policy.enabledLibraries: []`, which removes a user's access to every
  library unless `enableAllFolders` is true.
- A secret reference (`{ _file }`) in a path-valued `*File` option, such as
  `passwordFile`, is an error. `${VAR}` is still allowed in a path.
- On a server whose startup wizard has not been completed, jellarr now runs the
  wizard and creates the admin unless `startup.completeStartupWizard` is
  `false`.
- Installing or removing a plugin restarts Jellyfin in the same run. A declared
  plugin whose configuration can't be read fails the run instead of being
  skipped.
- A user with a `passwordFile` has their password reconciled: jellarr probes it
  and, only when the probe is rejected and a failed sign-in can't lock the user
  out, sets it. An empty password file is an error.
- The NixOS module starts jellarr from a timer at boot and after a switch that
  changes the config, instead of making `multi-user.target` wait for it. A
  package-only change runs at the next boot or on the schedule.
- Authentication uses the `Authorization: MediaBrowser Token=…` header, which
  Jellyfin 12 requires and 10.11 accepts.

### Added

- `--dry-run` (or `JELLARR_DRY_RUN=1`): read-only by construction, prints
  `path: current → desired` for every pending change with secrets masked, and
  exits 0 for no changes, 2 for changes pending and 1 for an error.
- Secret references: `{ _file: path }` for any value and `${VAR}` inside any
  string, resolved after the YAML is parsed so a secret can't change the
  config's structure.
- Authentication falls back to signing in as the admin by name with its
  `passwordFile` when no API key is set or the key is rejected. The key can also
  come from `JELLARR_API_KEY_FILE`.
- A wait for `/health` and for the API to stop returning 503 before the first
  call (`--waitTimeout` or `JELLARR_WAIT_TIMEOUT`, default 300 seconds).
- Startup wizard automation for a pristine server.
- Full API coverage for networking, trickplay, encoding, library options and
  server configuration; declarative `api_keys`; metadata configuration.
- Users: every settable `UserPolicy` field (41) and `UserConfiguration` field
  (16), including access schedules, download and bitrate policies, audio
  language preference, subtitle mode, tag restrictions and per-user library
  order. `AuthenticationProviderId`, `PasswordResetProviderId` and
  `InvalidLoginAttemptCount` are left to the server.
- `system.metadataOptions`, `system.contentTypes`, `system.pathSubstitutions`
  and `system.castReceiverApplications`.
- `branding.splashscreenFile` uploads a custom splashscreen when its bytes
  differ from the server's. It needs `splashscreenEnabled: true`.
- A `livetv` module for Live TV options, tuner hosts and listings providers. It
  adds and updates by default; `livetv.authoritative: true` also deletes entries
  the config doesn't declare.
- Plugins are matched by catalog GUID, kept up to date, and superseded copies
  are uninstalled.
- Library `ignoreChanges` for options another tool manages, covering every
  library option.
- NixOS module: `apiKeyFile` through systemd credentials, `configFile` as an
  alternative to `config`, `jellyfinService` ordering, `waitTimeout`,
  `{ _file = …; }` accepted wherever a string is, and `bootstrap.extraKeys` to
  seed other applications' API keys with known values.
- A migration guide from declarative-jellyfin, in
  `docs/migrating-from-declarative-jellyfin.md`.

### Fixed

- Every module makes no changes on a second run with the same config. Library
  options and branding used to rewrite themselves on every run.
- Removing an entry from a list now reaches the server; a removal from the
  middle of a list could previously corrupt it.
- Library updates to existing folders are detected, including folder names with
  quotes.
- User configuration is sent to `/Users/Configuration?userId=`; branding is read
  from `/Branding/Configuration`, which Jellyfin 12 requires.
- All server configuration fields are applied, not just an allowlist.
- API errors with an empty body, such as a 401, are reported as errors.
- A plugin install interrupted before its restart is completed on the next run,
  and server-added fields in plugin list entries are kept.
- Secrets are masked in logs and dry-run output, including their JSON-escaped
  form.
- The API-key bootstrap no longer deadlocks during activation, updates the key
  row by name, and fails on an unexpected database schema.

## [0.1.0] - 2025-01-24

### Added

#### Plugin Management

- **New Feature**: Full support for declarative plugin installation and
  configuration
- **Configuration Fields**:
  - `plugins[].name`: Plugin name (must match repository exactly,
    case-sensitive)
  - `plugins[].configuration`: Arbitrary key-value pairs for plugin-specific
    settings
- **API Integration**: Uses Jellyfin's `POST /Packages/Installed/{name}` for
  installation and `/Plugins/{pluginId}/Configuration` for configuration
- **Idempotent**: Skips already-installed plugins; only updates specified
  configuration fields while preserving unspecified settings
- **Workflow**: Newly installed plugins can be configured in the same run

#### Export Existing Configuration (Experimental)

- **New Feature**: `dump` command to export current Jellyfin server
  configuration as YAML
- **Usage**: `jellarr dump --baseUrl http://localhost:8096 > config.yml`
- **Exports**: System settings, encoding options, libraries, branding, users
  (without passwords), and plugin configurations
- **Use Case**: Bootstrap a new Jellarr config from an existing Jellyfin server
- **Note**: User passwords cannot be exported and must be added manually

#### API Key Bootstrap (NixOS)

- **New Feature**: Automatic API key provisioning for NixOS deployments
- **Problem Solved**: Eliminates manual API key creation for "from scratch"
  setups and disaster recovery scenarios
- **Configuration Options**:
  - `bootstrap.enable`: Toggle bootstrap on/off
  - `bootstrap.apiKeyFile`: Path to file containing the API key (works with
    sops-nix)
  - `bootstrap.apiKeyName`: Name for the key (defaults to "jellarr")
  - `bootstrap.jellyfinDataDir`: Path to Jellyfin data directory
  - `bootstrap.jellyfinService`: Systemd service name for Jellyfin
- **How It Works**: `jellarr-api-key-bootstrap` systemd oneshot service inserts
  the API key directly into Jellyfin's SQLite database before Jellarr runs
- **Idempotent**: Uses "insert if not present" SQL to prevent duplicate entries
- **Limitation**: Requires Jellarr and Jellyfin to be on the same host

#### Typed NixOS Module

- **New Feature**: Strongly-typed Nix module configuration with schema
  validation
- **Benefits**:
  - Catches configuration errors at Nix evaluation time
  - Better IDE support with proper NixOS option types
  - Validates all fields match expected types and constraints
- **Implementation**: Nix-native type definitions mirroring TypeScript Zod
  schemas

### Infrastructure

- **Cachix Integration**: Added Cachix caching for Nix builds in CI pipeline

### Changed

#### NixOS Module Improvements

- **Config Format**: Changed config type to `pkgs.formats.yaml` for better Nix
  integration and type coercion

#### Internal Architecture Refactor

- **Major Refactor**: Complete rewrite of apply/diff logic using `json-diff-ts`
  library
- **Problem Solved**: Eliminated ~1000 lines of redundant "deepEqual" comparison
  logic scattered across apply modules
- **New Pattern**: Fluent `ChangeSetBuilder` API for consistent diff handling
  - `atomize()` / `unatomize()`: Control change granularity
  - `withoutRemoves()` / `withoutUpdates()`: Filter change types
  - `withKey()`: Target specific configuration keys
- **Benefits**:
  - Consistent pattern across all apply modules
  - Cleaner separation between mappers and apply logic
  - More maintainable codebase
- **Modules Updated**: branding, encoding-options, library, system, users,
  plugins

### Configuration Example

```yaml
version: 1
base_url: "http://localhost:8096"
system:
    enableMetrics: true
    pluginRepositories:
        - name: "Jellyfin Official"
          url: "https://repo.jellyfin.org/releases/plugin/manifest.json"
          enabled: true
plugins:
    - name: "Trakt"
      configuration:
          TraktUsers:
              - ExtraLogging: true
    - name: "Playback Reporting"
```

### Breaking Changes

- **Potential Breaking**: This release is a significant internal rewrite. While
  the configuration format remains fully backward compatible, the underlying
  diff/apply logic has been completely reimplemented. Please test thoroughly
  before upgrading production systems.

---

## [0.0.3] - 2025-11-30

### Added

#### Startup Wizard Configuration

- **New Feature**: Support for completing Jellyfin's startup wizard via config
- **Configuration Fields**:
  - `startup.completeStartupWizard`: When `true`, marks the startup wizard as
    complete
- **API Integration**: Uses Jellyfin's `POST /Startup/Complete` endpoint
- **Use Case**: Useful for automated/declarative deployments where you want to
  skip the interactive startup wizard

#### User Management

- **New Feature**: Full support for declarative user creation and management
- **Configuration Fields**:
  - `users[].name`: Username for the account
  - `users[].password`: Plaintext password (development only)
  - `users[].passwordFile`: Path to file containing password (production
    recommended)
- **Security**: Supports secure password handling via file references for
  sops-nix integration
- **Idempotent**: Only creates users that don't already exist

#### User Policy Configuration

- **New Feature**: Configure user permissions and policies declaratively
- **Configuration Fields**:
  - `users[].policy.isAdministrator`: Grant admin privileges
  - `users[].policy.loginAttemptsBeforeLockout`: Set lockout threshold
- **API Integration**: Uses Jellyfin's `/Users/{userId}/Policy` endpoint
- **Comprehensive Testing**: Unit tests for types, API, mappers, and apply
  modules

### Infrastructure

#### CI Pipeline

- **New Feature**: Automated CI pipeline for quality validation
- **Checks**: Build, typecheck, ESLint, unit tests, Nix package build, flake
  check
- **Integration**: Runs on push to main and pull requests

#### NixOS VM Integration Tests

- **New Feature**: VM-based integration testing framework
- **Coverage**: Full end-to-end testing with real Jellyfin server

#### Code Quality Improvements

- **ESLint Enhancements**:
  - Added `stylisticTypeChecked` preset with targeted overrides
  - Added naming convention rules for consistent code style
  - Implemented maximum typedef strictness for explicit type annotations
  - Added comment policy automation via uncomment tool
- **Treefmt Refactor**: Split into separate format and lint modules for
  independent control

### Configuration Example

```yaml
version: 1
base_url: "http://localhost:8096"
system: {}
users:
    - name: "admin-user"
      passwordFile: "/run/secrets/admin-password"
      policy:
          isAdministrator: true
          loginAttemptsBeforeLockout: 3
    - name: "viewer-user"
      passwordFile: "/run/secrets/viewer-password"
startup:
    completeStartupWizard: true
```

### Breaking Changes

- None - All features are additive with full backward compatibility

---

## [0.0.2] - 2025-11-17

### Added

#### Branding Configuration Support

- **New Feature**: Full support for Jellyfin branding configuration options
- **Configuration Fields**:
  - `loginDisclaimer`: Custom text displayed on the login page (supports HTML)
  - `customCss`: Custom CSS to modify Jellyfin's appearance (supports @import
    rules)
  - `splashscreenEnabled`: Toggle the Jellyfin splash screen on/off
- **API Integration**: Uses Jellyfin's `/System/Configuration/Branding` endpoint
- **Idempotent Operations**: Only applies changes when configuration differs
  from server state
- **Null/Empty String Handling**: Properly handles server responses with null
  values

#### Documentation Improvements

- **Updated README**: Added complete branding configuration section with
  examples
- **Configuration Examples**:
  - Basic branding setup
  - HTML-enabled login disclaimers with hyperlinks
  - CSS theming with external stylesheets (Jellyskin theme example)
- **API Documentation**: Documented branding endpoints and expected schemas

### Technical Implementation

#### Architecture Adherence

- **Calculate/Apply Pattern**: Follows established pattern for clean separation
  of concerns
  - `calculateBrandingOptionsDiff()`: Pure calculation logic, returns schema or
    undefined
  - `applyBrandingOptions()`: Side effects only, handles API calls
- **Type Safety**: Full TypeScript integration with Zod validation
- **Naming Conventions**: Consistent with established `XyzAbcConfigType`
  patterns

#### Files Added/Modified

- `src/types/config/branding-options.ts` - Configuration type definitions
- `src/types/schema/branding-options.ts` - Server API schema types
- `src/mappers/branding-options.ts` - Config-to-schema transformation
- `src/apply/branding-options.ts` - Application logic with calculate/apply
  pattern
- `src/api/jellyfin_client.ts` - API client methods for branding endpoints
- `src/pipeline/index.ts` - Pipeline integration for branding configuration
- `tests/**/*branding-options.spec.ts` - Comprehensive test suites

### Configuration Example

```yaml
version: 1
base_url: "https://jellyfin.example.com"
system:
# ... system config
branding:
    loginDisclaimer: |
        Welcome! Configured by <a href="https://github.com/venkyr77/jellarr">Jellarr</a>
    customCss: |
        @import url("https://cdn.jsdelivr.net/npm/jellyskin@latest/dist/main.css");
    splashscreenEnabled: false
```

### Breaking Changes

- None - This is an additive feature with full backward compatibility

---

## [0.0.1] - Initial Release

### Added

- Initial implementation of declarative Jellyfin configuration management
- Support for system configuration (metrics, plugin repositories, trickplay
  options)
- Support for encoding configuration (hardware encoding settings)
- Support for library configuration (content scanning and metadata options)
- TypeScript implementation with strict type safety
- Comprehensive test suite with integration testing
- Nix flakes support for reproducible builds
- Docker integration with distroless images
- CLI interface with YAML configuration files

### Technical Features

- **Calculate/Apply Pattern**: Clean separation between configuration
  calculation and application
- **Idempotent Operations**: Only modifies explicitly specified configuration
  fields
- **API Integration**: Uses Jellyfin's OpenAPI specification with generated
  types
- **Validation**: Zod-based configuration validation with detailed error
  messages
- **Authentication**: Secure API key-based authentication with environment
  variables

### Supported Configuration Areas

- **System Configuration**: Server metrics, plugin repositories, trickplay
  options
- **Encoding Configuration**: Hardware encoding, codec preferences, quality
  settings
- **Library Configuration**: Content scanning intervals, metadata providers,
  subtitle preferences

[0.5.1]: https://github.com/sini/jellarr/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/sini/jellarr/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sini/jellarr/compare/v0.3.5...v0.4.0
[0.3.5]: https://github.com/sini/jellarr/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/sini/jellarr/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/sini/jellarr/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/sini/jellarr/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/sini/jellarr/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/sini/jellarr/releases/tag/v0.3.0
[0.1.0]: https://github.com/venkyr77/jellarr/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/venkyr77/jellarr/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/venkyr77/jellarr/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/venkyr77/jellarr/releases/tag/v0.0.1
