# Contributing

Bugs and ideas go in [issues](https://github.com/sini/jellarr/issues); changes
go in a pull request against `main`.

## Build

```bash
pnpm install               # needs Node.js 24+ and pnpm
pnpm build                 # bundle with esbuild
nix build .#default        # the packaged CLI
nix build .#docker-image   # the container image
```

## Checks

Run these before opening a pull request. CI runs the same set.

```bash
pnpm typecheck             # tsc --noEmit
pnpm eslint
pnpm test                  # vitest
nix fmt                    # formats every file type in the repo
nix flake check            # module tests and the NixOS VM tests
```

The VM tests start Jellyfin 10.11 and 12 and are slow; to run one, build
`.#checks.<system>.<name>` (see `nix/tests/integration`). A change that adds a
config field needs the zod type (`src/types/config`), the nix module
(`nix/module/types`), a mapper and tests on both sides.

## Commits

Use [conventional commits](https://www.conventionalcommits.org/):
`fix(module):
...`, `feat(users): ...`, `docs: ...`, `test: ...`. Keep the
subject lowercase and imperative, and one change per commit. Say what changed
and, in the body, why. Reference an issue as `Fixes owner/repo#N`.

## Credit for adapted work

When a commit adapts someone else's work, keep their credit in the trailers:

```
Co-authored-by: Name <email>
Adapted-from: https://github.com/owner/repo/pull/N
```

`Co-authored-by` credits the person; `Adapted-from` points at the original
change.

## Issues

Open them at <https://github.com/sini/jellarr/issues>. Include the jellarr
version, the Jellyfin version, the config involved (with secrets removed) and
the output of a `--dry-run`.
