import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import { logger, maskSecrets } from "../../src/lib/logger";

describe("lib/logger", () => {
  it("whenInfoCalled_thenWritesToConsoleLog()", () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Act
    logger.info("hello");

    // Assert
    expect(spy).toHaveBeenCalledWith("hello");

    spy.mockRestore();
  });

  it("whenWarnCalled_thenWritesToConsoleWarn()", () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    // Act
    logger.warn("w");

    // Assert
    expect(spy).toHaveBeenCalledWith("w");

    spy.mockRestore();
  });

  it("whenErrorCalled_thenWritesToConsoleError()", () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Act
    logger.error("e");

    // Assert
    expect(spy).toHaveBeenCalledWith("e");

    spy.mockRestore();
  });
});

describe("lib/logger masking", () => {
  afterEach(() => {
    maskSecrets(new Set());
    vi.restoreAllMocks();
  });

  it("whenSecretIsJsonEscaped_thenItIsMaskedToo", () => {
    // Arrange
    const secret: string = 'pa"ss\\w\nd';
    maskSecrets(new Set([secret]));
    const spy: Mock = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Act
    logger.info(JSON.stringify({ x: secret }));
    logger.info(secret);

    // Assert
    expect(spy).toHaveBeenNthCalledWith(1, '{"x":"***"}');
    expect(spy).toHaveBeenNthCalledWith(2, "***");
  });
});
