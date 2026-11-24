# One switch restarts Jellyfin and fires jellarr-apply.timer at once.
# On 12 this guards the setup server that answers /health with "Degraded" and
# then drops the connection. The 500 from /System/Info/Public while 10.11 loads
# its configuration cannot be reproduced in a VM, so 10.11 only checks the switch.
def show(server, unit, prop):
    return server.succeed(f"systemctl show {unit} -p {prop} --value").strip()


def wait_idle(server):
    server.wait_until_succeeds(
        "systemctl show jellarr.service -p ActiveState --value | grep -qx -e inactive -e failed",
        timeout=WAIT_TIMEOUT,
    )


def run_jf_restart_test(server):
    wait_for_machine(server)
    wait_for_bootstrap(server)

    # the timer the module normally enables at boot: its restart on a config
    # change is what runs jellarr during the switch
    server.succeed("systemctl start jellarr-apply.timer")
    server.wait_until_succeeds(
        "systemctl show jellarr.service -p InvocationID --value | grep -q .",
        timeout=WAIT_TIMEOUT,
    )
    wait_idle(server)
    assert show(server, "jellarr.service", "Result") == "success"
    assert get_jellyfin_data(server, "/System/Configuration")["UICulture"] == "en-GB"

    jf_before = show(server, "jellyfin.service", "InvocationID")
    jarr_before = show(server, "jellarr.service", "InvocationID")

    server.succeed(
        "/run/booted-system/specialisation/restart/bin/switch-to-configuration test"
    )

    # jellarr ran again, started while Jellyfin was coming back up
    server.wait_until_succeeds(
        f"test $(systemctl show jellarr.service -p InvocationID --value) != {jarr_before}",
        timeout=WAIT_TIMEOUT,
    )
    wait_idle(server)
    assert show(server, "jellarr.service", "Result") == "success", server.succeed(
        "journalctl -u jellarr.service --no-pager | tail -n 40"
    )

    # the switch restarted Jellyfin itself
    assert show(server, "jellyfin.service", "InvocationID") != jf_before
    assert "JELLARR_TEST_MARK=2" in show(server, "jellyfin.service", "Environment")

    assert get_jellyfin_data(server, "/System/Configuration")["UICulture"] == "de-DE"
