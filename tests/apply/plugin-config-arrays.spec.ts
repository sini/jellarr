import { describe, it, expect } from "vitest";
import { calculatePluginConfigurationDiff } from "../../src/apply/plugins";
import type { BasePluginConfigurationSchema } from "../../src/types/schema/plugins";
import type { PluginConfigurationConfig } from "../../src/types/config/plugins";

function withProviders(roles: string[]): BasePluginConfigurationSchema {
  return {
    Extras: {},
    Providers: { primary: { Roles: roles, Enabled: true, Hand: "set" } },
  } as unknown as BasePluginConfigurationSchema;
}

function desiredRoles(roles: string[]): PluginConfigurationConfig {
  return { Providers: { primary: { Roles: roles } } };
}

function rolesAfter(
  current: string[],
  desired: string[],
): string[] | undefined {
  const result: BasePluginConfigurationSchema | undefined =
    calculatePluginConfigurationDiff(
      withProviders(current),
      desiredRoles(desired),
    );
  return result === undefined
    ? undefined
    : (
        result as unknown as {
          Providers: { primary: { Roles: string[] } };
        }
      ).Providers.primary.Roles;
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
  it("array of objects drops removed items and keeps the survivors' server fields", () => {
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
    expect(result).toEqual({ Providers: [{ Name: "y", Extra: 2 }] });
  });
  it("undeclared keys and arrays survive", () => {
    const current: BasePluginConfigurationSchema = {
      ...withProviders(["a", "b"]),
      Other: [1, 2],
    } as unknown as BasePluginConfigurationSchema;
    const result: unknown = calculatePluginConfigurationDiff(
      current,
      desiredRoles(["a"]),
    );
    expect(result).toEqual({
      Extras: {},
      Other: [1, 2],
      Providers: { primary: { Roles: ["a"], Enabled: true, Hand: "set" } },
    });
  });

  describe("arrays of objects whose elements the server extends", () => {
    const serverState: BasePluginConfigurationSchema = {
      Items: [
        { Name: "a", Added: 1 },
        { Name: "b", Added: 2 },
      ],
      Hand: "set",
    } as unknown as BasePluginConfigurationSchema;

    it("two runs with an unchanged config send nothing", () => {
      const desired: PluginConfigurationConfig = {
        Items: [{ Name: "a" }, { Name: "b" }],
      };
      const first: BasePluginConfigurationSchema | undefined =
        calculatePluginConfigurationDiff(
          { Items: [{ Name: "a" }], Hand: "set" } as never,
          desired,
        );
      expect(first).toEqual({
        Items: [{ Name: "a" }, { Name: "b" }],
        Hand: "set",
      });
      expect(
        calculatePluginConfigurationDiff(serverState, desired),
      ).toBeUndefined();
    });

    it("an added element keeps the server fields of the others", () => {
      expect(
        calculatePluginConfigurationDiff(
          {
            L: [
              { n: "a", id: 1, secret: "s" },
              { n: "b", id: 2 },
            ],
          } as never,
          { L: [{ n: "a" }, { n: "c" }] },
        ),
      ).toEqual({ L: [{ n: "a", id: 1, secret: "s" }, { n: "c" }] });
    });

    it("an edited element is sent as declared and the others keep their fields", () => {
      expect(
        calculatePluginConfigurationDiff(serverState, {
          Items: [{ Name: "a" }, { Name: "c" }],
        }),
      ).toEqual({
        Items: [{ Name: "a", Added: 1 }, { Name: "c" }],
        Hand: "set",
      });
    });

    it("a reorder is a change and each element keeps its own fields", () => {
      expect(
        calculatePluginConfigurationDiff(serverState, {
          Items: [{ Name: "b" }, { Name: "a" }],
        }),
      ).toEqual({
        Items: [
          { Name: "b", Added: 2 },
          { Name: "a", Added: 1 },
        ],
        Hand: "set",
      });
    });

    it("a different length is a change", () => {
      expect(
        calculatePluginConfigurationDiff(serverState, {
          Items: [{ Name: "a" }],
        }),
      ).toEqual({ Items: [{ Name: "a", Added: 1 }], Hand: "set" });
    });

    it("duplicate declared elements each take a distinct current element", () => {
      expect(
        calculatePluginConfigurationDiff(
          { L: [{ n: "a", id: 1 }, { n: "a", id: 2 }, { n: "z" }] } as never,
          { L: [{ n: "a" }, { n: "a" }] },
        ),
      ).toEqual({
        L: [
          { n: "a", id: 1 },
          { n: "a", id: 2 },
        ],
      });
    });
  });
});

describe("plugin configuration value coercion", () => {
  it("a string equal to the current number or boolean is no change", () => {
    expect(
      calculatePluginConfigurationDiff(
        { Port: 8096, On: true, Off: false } as never,
        { Port: "8096", On: "true", Off: "false" },
      ),
    ).toBeUndefined();
  });

  it("a differing string is written as the current value's type", () => {
    expect(
      calculatePluginConfigurationDiff({ Port: 8096, On: true } as never, {
        Port: "9000",
        On: "false",
      }),
    ).toEqual({ Port: 9000, On: false });
  });

  it("a string that does not parse exactly stays a string", () => {
    expect(
      calculatePluginConfigurationDiff({ Port: 8096 } as never, {
        Port: "80x",
      }),
    ).toEqual({ Port: "80x" });
  });

  it("desired null equals an absent current value", () => {
    expect(
      calculatePluginConfigurationDiff({ a: 1 } as never, { a: 1, b: null }),
    ).toBeUndefined();
  });
});
