# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Every settable `UserPolicy` field (41) and `UserConfiguration` field (16) can
  be configured, in the config, the NixOS module and `--dump`; the
  server-managed `AuthenticationProviderId`, `PasswordResetProviderId` and
  `InvalidLoginAttemptCount` are excluded
- `system.metadataOptions`, `system.contentTypes`, `system.pathSubstitutions`
  and `system.castReceiverApplications`: declared lists replace the server's,
  and fields the server adds to an element are tolerated
- `branding.splashscreenFile` uploads a custom splashscreen, only when its bytes
  differ from what the server serves.

### Changed

- An empty `policy.enabledLibraries` now clears the user's enabled folders
  instead of being ignored, as every declared list is authoritative

### Fixed

- `passwordFile: { _file: ... }` no longer silently uses the referenced file's
  contents as a path; a secret reference in a `*File` option is an error.
  `${VAR}` stays allowed in a path. The NixOS module types `passwordFile` as a
  plain string

## [0.3.0] - 2026-11-21

The first release of the community-maintained fork at
[sini/jellarr](https://github.com/sini/jellarr). It carries upstream's
unreleased v0.1.1 branch, the open upstream pull requests and work from other
forks; the README lists who contributed what. Version 0.2.x is skipped because
another fork has already published it.

### Breaking changes

- Strings anywhere in the config containing `${NAME}` are expanded from the
  environment; an undefined variable fails the run. Write `$${` for a literal
  `${`. Other `$` characters are left alone.
- A declared list replaces the server's list in every module, so removing an
  entry from the config removes it from Jellyfin. The one exception is
  `policy.enabledLibraries: []`, which is still ignored.
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
- Users: download and bitrate policies, audio language preference, subtitle
  mode, tag restrictions and per-user library order.
- Plugins are matched by catalog GUID, kept up to date, and superseded copies
  are uninstalled.
- Library `ignoreChanges` for options another tool manages, covering every
  library option.
- NixOS module: `apiKeyFile` through systemd credentials, `configFile` as an
  alternative to `config`, `jellyfinService` ordering, `waitTimeout`, and
  `{ _file = …; }` accepted wherever a string is.

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

[0.3.0]: https://github.com/sini/jellarr/releases/tag/v0.3.0
[0.1.0]: https://github.com/venkyr77/jellarr/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/venkyr77/jellarr/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/venkyr77/jellarr/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/venkyr77/jellarr/releases/tag/v0.0.1
