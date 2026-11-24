CONFIG = "/tmp/jellarr-network-restart.yml"


def jellarr(server, base_url, networking):
    jellarr_bin = server.succeed(
        "systemctl cat jellarr.service | sed -n 's/^ExecStart=//p'"
    ).strip()
    yaml = (
        f"version: 1\nbase_url: {base_url}\nsystem: {{}}\nnetworking:\n{networking}\n"
    )
    server.succeed(f"cat > {CONFIG} <<'EOF'\n{yaml}EOF")
    return server.succeed(
        f"cd /var/lib/jellarr && JELLARR_API_KEY=test-api-key {jellarr_bin} apply --configFile {CONFIG} 2>&1"
    )


def status(server, url):
    return server.succeed(
        f"curl -s -o /dev/null -w '%{{http_code}}' {url} || true"
    ).strip()


def run_network_restart_test(server):
    wait_for_machine(server)
    wait_for_bootstrap(server)

    # a port is read once at startup: jellarr restarts Jellyfin and waits on the new port
    first = jellarr(server, "http://localhost:8096", "  internalHttpPort: 8097")
    print(first)
    assert "restarting Jellyfin to apply internalHttpPort" in first, first
    assert status(server, "http://localhost:8097/health") == "200"
    assert status(server, "http://localhost:8096/health") != "200"

    # nothing left to change, nothing to restart
    second = jellarr(server, "http://localhost:8097", "  internalHttpPort: 8097")
    print(second)
    assert "networking config already up to date" in second, second
    assert "restarting Jellyfin" not in second, second

    # once baseUrl changes the server cannot be restarted over the API: jellarr
    # writes it last, says so, and a restart from outside applies it
    third = jellarr(server, "http://localhost:8097", "  baseUrl: /jf")
    print(third)
    assert "restart it yourself" in third, third
    assert "restarting Jellyfin" not in third, third
    server.succeed("systemctl restart jellyfin.service")
    server.wait_until_succeeds("curl -sf http://localhost:8097/jf/health", timeout=300)
