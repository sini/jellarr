import { describe, it, expect } from "vitest";
import { calculatePluginConfigurationDiff } from "../../src/apply/plugins";
import type { BasePluginConfigurationSchema } from "../../src/types/schema/plugins";
import type { PluginConfigurationConfig } from "../../src/types/config/plugins";

function ssoWith(roles: string[]): BasePluginConfigurationSchema {
  return {
    SamlConfigs: {},
    OidConfigs: { kanidm: { AdminRoles: roles, Enabled: true, Hand: "set" } },
  } as unknown as BasePluginConfigurationSchema;
}

function desiredRoles(roles: string[]): PluginConfigurationConfig {
  return { OidConfigs: { kanidm: { AdminRoles: roles } } };
}

function rolesAfter(
  current: string[],
  desired: string[],
): string[] | undefined {
  const result: BasePluginConfigurationSchema | undefined =
    calculatePluginConfigurationDiff(ssoWith(current), desiredRoles(desired));
  return result === undefined
    ? undefined
    : (
        result as unknown as {
          OidConfigs: { kanidm: { AdminRoles: string[] } };
        }
      ).OidConfigs.kanidm.AdminRoles;
}

describe("plugin configuration arrays are replaced whole", () => {
  it("shrink", () => {
    expect(rolesAfter(["a", "b"], ["a"])).toEqual(["a"]);
  });
  it("grow", () => {
    expect(rolesAfter(["a"], ["a", "b"])).toEqual(["a", "b"]);
  });
  it("reorder", () => {
    expect(rolesAfter(["a", "b", "c"], ["c", "a", "b"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("mid-element removal", () => {
    expect(rolesAfter(["a", "b", "c"], ["a", "c"])).toEqual(["a", "c"]);
  });
  it("empty desired array clears", () => {
    expect(rolesAfter(["a", "b"], [])).toEqual([]);
  });
  it("identical arrays are no change", () => {
    expect(rolesAfter(["a", "b"], ["a", "b"])).toBeUndefined();
  });
  it("array of objects is replaced whole, dropping removed items and keys", () => {
    const current: BasePluginConfigurationSchema = {
      Providers: [
        { Name: "x", Extra: 1 },
        { Name: "y", Extra: 2 },
      ],
    } as unknown as BasePluginConfigurationSchema;
    const result: BasePluginConfigurationSchema | undefined =
      calculatePluginConfigurationDiff(current, {
        Providers: [{ Name: "y" }],
      });
    expect(result).toEqual({ Providers: [{ Name: "y" }] });
  });
  it("undeclared keys and arrays survive", () => {
    const current: BasePluginConfigurationSchema = {
      ...ssoWith(["a", "b"]),
      Other: [1, 2],
    } as unknown as BasePluginConfigurationSchema;
    const result: unknown = calculatePluginConfigurationDiff(
      current,
      desiredRoles(["a"]),
    );
    expect(result).toEqual({
      SamlConfigs: {},
      Other: [1, 2],
      OidConfigs: { kanidm: { AdminRoles: ["a"], Enabled: true, Hand: "set" } },
    });
  });
});
