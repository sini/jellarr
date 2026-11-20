import { describe, it, expect, afterEach, vi, type Mock } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getPassword } from "../../src/mappers/users";
import { logger, maskSecrets } from "../../src/lib/logger";

describe("mappers/users getPassword", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    maskSecrets(new Set());
  });

  it.each(["", "\n", "  \n"])(
    "whenPasswordFileIsBlank_thenThrows(%j)",
    async (contents: string) => {
      // Arrange
      const dir: string = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-"));
      const passwordFile: string = path.join(dir, "pw");
      await fs.writeFile(passwordFile, contents);

      // Act + Assert
      expect(() => getPassword({ name: "alice", passwordFile })).toThrow(
        /empty/,
      );
      await fs.rm(dir, { recursive: true, force: true });
    },
  );

  it("whenPasswordComesFromFile_thenItIsMasked", async () => {
    // Arrange
    const dir: string = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-"));
    const passwordFile: string = path.join(dir, "pw");
    await fs.writeFile(passwordFile, "s3cret\n");
    maskSecrets(new Set());
    const spy: Mock = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Act
    expect(getPassword({ name: "alice", passwordFile })).toBe("s3cret");
    logger.info("pw is s3cret");

    // Assert
    expect(spy).toHaveBeenCalledWith("pw is ***");
    await fs.rm(dir, { recursive: true, force: true });
  });
});
