CONFIG_DIR = "/etc/jellarr-container"


def run_image(server, *flags):
    # as a Kubernetes Job runs it: no command, only args, the image's own user
    # (65534), a read-only root, the config and the key file mounted read-only
    return server.execute(
        "podman run --rm --network host --read-only "
        f"-v {CONFIG_DIR}:/config:ro -v {CONFIG_DIR}/api-key:/secrets/api-key:ro "
        "-e JELLARR_API_KEY_FILE=/secrets/api-key "
        "localhost/jellarr:latest --configFile /config/config.yml "
        + " ".join(flags)
        + " 2>&1"
    )


def run_container_test(server):
    wait_for_machine(server)
    wait_for_bootstrap(server)

    server.succeed(f"podman load -i {IMAGE}")
    assert (
        server.succeed(
            "podman image inspect localhost/jellarr:latest --format '{{.Config.User}}'"
        ).strip()
        == "65534:65534"
    )

    server.succeed(f"mkdir -p {CONFIG_DIR}")
    server.succeed(
        f"printf 'version: 1\\nbase_url: http://localhost:8096\\nsystem:\\n  uiCulture: fr-FR\\n' > {CONFIG_DIR}/config.yml"
    )
    server.succeed(f"printf test-api-key > {CONFIG_DIR}/api-key")
    # the container user is 65534, not root
    server.succeed(f"chmod 0755 {CONFIG_DIR} && chmod 0444 {CONFIG_DIR}/*")

    assert get_jellyfin_data(server, "/System/Configuration")["UICulture"] != "fr-FR"

    status, out = run_image(server)
    print(out)
    assert status == 0, out
    assert get_jellyfin_data(server, "/System/Configuration")["UICulture"] == "fr-FR"

    status, out = run_image(server)
    print(out)
    assert status == 0, out
    assert "system config already up to date" in out, out
    assert get_jellyfin_data(server, "/System/Configuration")["UICulture"] == "fr-FR"

    # converged: nothing pending, so dry-run exits 0 rather than 2
    status, out = run_image(server, "--dry-run")
    print(out)
    assert status == 0, out
