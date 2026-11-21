import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveFileReferences, resolveValue } from "../../src/lib/file-refs";
import YAML from "yaml";
import { promises as fs } from "fs";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

const mockReadFile: ReturnType<typeof vi.fn> = fs.readFile as ReturnType<
  typeof vi.fn
>;

describe("resolveFileReferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a _file reference in a *File path field", async () => {
    const input: Record<string, unknown> = {
      users: [{ passwordFile: { _file: "/run/secrets/path" } }],
    };

    await expect(resolveFileReferences(input)).rejects.toThrow(
      "'passwordFile' is a path",
    );
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("allows ${VAR} in a *File path field", async () => {
    process.env.JELLARR_TEST_DIR = "/creds";
    const input: Record<string, unknown> = {
      passwordFile: "${JELLARR_TEST_DIR}/admin",
    };

    await expect(resolveFileReferences(input)).resolves.toStrictEqual({
      passwordFile: "/creds/admin",
    });
    delete process.env.JELLARR_TEST_DIR;
  });

  it("should resolve a simple _file reference", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("secret-value\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/api-key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({ ApiKey: "secret-value" });
    expect(mockReadFile).toHaveBeenCalledWith("/run/secrets/api-key", "utf8");
  });

  it("should pass through plain values unchanged", async () => {
    // Arrange
    const input: Record<string, unknown> = {
      stringValue: "test",
      numberValue: 123,
      booleanValue: true,
      nullValue: null,
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      stringValue: "test",
      numberValue: 123,
      booleanValue: true,
      nullValue: null,
    });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("should not resolve objects with _file plus extra keys", async () => {
    // Arrange
    const input: Record<string, unknown> = {
      Setting: { _file: "/some/path", extra: "key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Setting: { _file: "/some/path", extra: "key" },
    });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("should resolve _file references inside nested objects", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("nested-secret\n");
    const input: Record<string, unknown> = {
      Outer: {
        Inner: { _file: "/run/secrets/nested" },
        Plain: "value",
      },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Outer: { Inner: "nested-secret", Plain: "value" },
    });
  });

  it("should resolve _file references inside arrays", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("array-secret\n");
    const input: Record<string, unknown> = {
      Items: [{ _file: "/run/secrets/item" }, "plain-value"],
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Items: ["array-secret", "plain-value"],
    });
  });

  it("should resolve multiple _file references", async () => {
    // Arrange
    mockReadFile
      .mockResolvedValueOnce("secret-one\n")
      .mockResolvedValueOnce("secret-two\n");
    const input: Record<string, unknown> = {
      KeyOne: { _file: "/run/secrets/one" },
      KeyTwo: { _file: "/run/secrets/two" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      KeyOne: "secret-one",
      KeyTwo: "secret-two",
    });
  });

  it("should throw when file cannot be read", async () => {
    // Arrange
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/nonexistent/path" },
    };

    // Act & Assert
    await expect(resolveFileReferences(input)).rejects.toThrow(
      "Failed to read file referenced by _file: /nonexistent/path",
    );
  });

  it("should trim whitespace from file contents", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("  secret-with-whitespace  \n\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({ ApiKey: "secret-with-whitespace" });
  });

  it("should handle mixed inline and _file values", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("file-secret\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/key" },
      NormalSetting: "inline-value",
      NumberSetting: 42,
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      ApiKey: "file-secret",
      NormalSetting: "inline-value",
      NumberSetting: 42,
    });
  });

  it("should resolve _file references inside objects within arrays", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("deep-secret\n");
    const input: Record<string, unknown> = {
      Users: [
        { AccessToken: { _file: "/run/secrets/token" }, Name: "alice" },
        { AccessToken: "inline-token", Name: "bob" },
      ],
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Users: [
        { AccessToken: "deep-secret", Name: "alice" },
        { AccessToken: "inline-token", Name: "bob" },
      ],
    });
    expect(mockReadFile).toHaveBeenCalledWith("/run/secrets/token", "utf8");
  });

  it("should return empty object for empty input", async () => {
    // Arrange
    const input: Record<string, unknown> = {};

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({});
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe("env substitution", () => {
  it("expands ${VAR} inside strings, with $${ as a literal ${", async () => {
    process.env.JF_TEST_HOST = "example.org";
    const result: Record<string, unknown> = await resolveFileReferences({
      url: "https://${JF_TEST_HOST}/x",
      price: "$$5",
      lit: "$${JF_TEST_HOST}",
      pw: "pa$$word",
      list: ["${JF_TEST_HOST}"],
      n: 3,
    });
    expect(result).toEqual({
      url: "https://example.org/x",
      price: "$$5",
      lit: "${JF_TEST_HOST}",
      pw: "pa$$word",
      list: ["example.org"],
      n: 3,
    });
  });

  it("expands ${VAR} in a _file path", async () => {
    process.env.JF_TEST_DIR = "/run/secrets";
    mockReadFile.mockResolvedValueOnce("v\n");
    const result: unknown = await resolveValue({ _file: "${JF_TEST_DIR}/x" });
    expect(mockReadFile).toHaveBeenCalledWith("/run/secrets/x", "utf8");
    expect(result).toBe("v");
  });

  it("throws on an undefined variable", async () => {
    await expect(
      resolveFileReferences({ a: "${JF_TEST_UNDEFINED_VAR}" }),
    ).rejects.toThrow(/JF_TEST_UNDEFINED_VAR/);
  });

  it("keeps structure when a secret contains YAML syntax", async () => {
    const nasty: string = 'x: y # z\n- "q"\n"lead';
    process.env.JF_TEST_NASTY = nasty;
    const parsed: unknown = YAML.parse('a: "${JF_TEST_NASTY}"\nb: 1\n');
    const result: unknown = await resolveValue(parsed);
    expect(result).toEqual({ a: nasty, b: 1 });
  });
});

describe("dollar escaping in rendered markup", () => {
  const dollar: string = "$";
  const cssLines: string[] = Array.from(
    { length: 16 },
    (unused: unknown, i: number) =>
      `  .c${i.toString()}::after { content: "${dollar}{price}"; background: url(${dollar}{base}/i${i.toString()}.png); }`,
  );
  const original: string = [
    "<style>",
    ...cssLines,
    "</style>",
    '<div class="login">',
    "  <span>Price: $5</span>",
    "  <script>const t = `" + dollar + "{name}`; const re = /a$/;</script>",
    "  <p>${user} paid $$ and $</p>",
    "</div>",
    "",
  ].join("\n");

  it("round-trips a long multi-line string with every ${ escaped", async () => {
    const escaped: string = original.split("${").join("$${");
    expect(escaped.split("\n").length).toBeGreaterThan(20);
    expect(escaped).toContain(dollar + dollar + "{price}");
    expect(escaped).toContain("paid $$ and $");

    const result: Record<string, unknown> = await resolveFileReferences({
      html: escaped,
    });

    expect(result.html).toBe(original);
  });

  it("leaves a lone dollar not followed by a brace or dollar unchanged", async () => {
    const result: Record<string, unknown> = await resolveFileReferences({
      a: "cost $5, regex a$, end $",
    });
    expect(result.a).toBe("cost $5, regex a$, end $");
  });
});
