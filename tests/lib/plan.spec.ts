import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import { Plan } from "../../src/lib/plan";

describe("lib/plan masking of server-side values", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("whenArrayElementsCarryCredentialFields_thenTheirValuesAreMasked", () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const plan: Plan = new Plan(new Set(["declared-secret"]));

    // Act
    plan.change(
      "plugin x.configuration",
      { L: [{ n: "a", ApiKey: "server-key", Password: "pw" }] },
      { L: [{ n: "a", ApiKey: "server-key", Password: "pw" }, { n: "b" }] },
    );

    // Assert
    const out: string = spy.mock.calls
      .map((call: unknown[]) => call[0])
      .join("\n");
    expect(out).toContain('"n":"b"');
    expect(out).not.toContain("server-key");
    expect(out).not.toContain('"pw"');
  });

  it("whenAScalarFieldIsCredentialNamed_thenItIsMasked", () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Act
    new Plan().change("s", { clientSecret: "old" }, { clientSecret: "new" });

    // Assert
    expect(spy).toHaveBeenCalledWith("  s.clientSecret: *** → ***");
  });
});
