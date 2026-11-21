import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveApiKey } from "../../src/lib/api-key";

/* eslint-disable @typescript-eslint/naming-convention */

function keyFile(content: string): string {
  const path: string = join(mkdtempSync(join(tmpdir(), "key-")), "k");
  writeFileSync(path, content);
  return path;
}

describe("resolveApiKey", () => {
  it("returns undefined when nothing is set", () => {
    expect(resolveApiKey({})).toBeUndefined();
  });

  it("returns the environment key", () => {
    expect(resolveApiKey({ JELLARR_API_KEY: "abc" })).toBe("abc");
  });

  it("reads and trims the key file", () => {
    expect(resolveApiKey({ JELLARR_API_KEY_FILE: keyFile("abc\n") })).toBe(
      "abc",
    );
  });

  it("rejects both being set", () => {
    expect(() =>
      resolveApiKey({
        JELLARR_API_KEY: "a",
        JELLARR_API_KEY_FILE: keyFile("b"),
      }),
    ).toThrow(/both set/);
  });

  it("fails on an unreadable file", () => {
    expect(() =>
      resolveApiKey({ JELLARR_API_KEY_FILE: "/nonexistent/key" }),
    ).toThrow();
  });
});
