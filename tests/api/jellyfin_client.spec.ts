import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { createJellyfinClient } from "../../src/api/jellyfin_client";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { ServerConfigurationSchema } from "../../src/types/schema/system";
import type {
  VirtualFolderInfoSchema,
  AddVirtualFolderDtoSchema,
  LibraryOptionsSchema,
} from "../../src/types/schema/library";
import type { EncodingOptionsSchema } from "../../src/types/schema/encoding-options";
import type { MetadataConfigurationSchema } from "../../src/types/schema/metadata";
import type { BrandingOptionsDtoSchema } from "../../src/types/schema/branding-options";
import type {
  UserDtoSchema,
  CreateUserByNameSchema,
  UserPolicySchema,
} from "../../src/types/schema/users";
import type {
  PluginInfoSchema,
  PackageInfoSchema,
  BasePluginConfigurationSchema,
} from "../../src/types/schema/plugins";

const baseUrl: string = "http://localhost:8096/";
const apiKey: string = "test-key";

let fetchMock: Mock;

function mockFetchJson(body: unknown, status: number = 200): void {
  fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  );
}

function mockFetchNoContent(status: number = 204): void {
  fetchMock = vi
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(null, { status }));
}

function getLastRequest(): Request {
  const calls: unknown[][] = fetchMock.mock.calls;
  const lastCall: unknown[] | undefined = calls.at(-1);
  if (!lastCall || !(lastCall[0] instanceof Request)) {
    throw new Error("No Request found in fetch mock calls");
  }
  return lastCall[0];
}

describe("api/jf System façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /System/Configuration returns JSON then it returns the parsed object", async (): Promise<void> => {
    // Arrange
    const payload: ServerConfigurationSchema = {
      EnableMetrics: true,
    } as ServerConfigurationSchema;
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: ServerConfigurationSchema =
      await jellyfinClient.getSystemConfiguration();

    // Assert
    expect(out).toEqual(payload);

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/System\/Configuration$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
    expect(req.headers.get("Authorization")).toContain('Client="jellarr"');
  });

  it("when POST /System/Configuration succeeds with JSON then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    mockFetchJson({});

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.updateSystemConfiguration({ EnableMetrics: false });

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Configuration$/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("EnableMetrics");
  });

  it("when POST /System/Configuration returns 204 then it still resolves (no body)", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.updateSystemConfiguration({});

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Configuration$/);
  });

  it("when GET /System/Configuration fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getSystemConfiguration()).rejects.toThrow(
      /GET \/System\/Configuration failed/i,
    );
  });

  it("when GET /System/Configuration returns 401 with an empty body then it throws", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(null, { status: 401, headers: { "content-length": "0" } }),
      );

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getSystemConfiguration()).rejects.toThrow(
      /GET \/System\/Configuration failed: 401/,
    );
  });

  it("when POST /System/Configuration fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 400 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.updateSystemConfiguration({})).rejects.toThrow(
      /POST \/System\/Configuration failed/i,
    );
  });
});

describe("api/jf Library façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /Library/VirtualFolders returns JSON then it returns the parsed array", async (): Promise<void> => {
    // Arrange
    const payload: VirtualFolderInfoSchema[] = [
      {
        Name: "Movies",
        CollectionType: "movies",
        Locations: ["/data/movies"],
        ItemId: "123",
      },
      {
        Name: "Shows",
        CollectionType: "tvshows",
        Locations: ["/data/shows"],
        ItemId: "456",
      },
    ];
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: VirtualFolderInfoSchema[] =
      await jellyfinClient.getVirtualFolders();

    // Assert
    expect(out).toEqual(payload);
    expect(out).toHaveLength(2);
    expect(out[0].Name).toBe("Movies");
    expect(out[1].CollectionType).toBe("tvshows");

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/Library\/VirtualFolders$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when GET /Library/VirtualFolders returns empty array then it returns empty array", async (): Promise<void> => {
    // Arrange
    mockFetchJson([]);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: VirtualFolderInfoSchema[] =
      await jellyfinClient.getVirtualFolders();

    // Assert
    expect(out).toEqual([]);
    expect(out).toHaveLength(0);
  });

  it("when GET /Library/VirtualFolders fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 401 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getVirtualFolders()).rejects.toThrow(
      /GET \/Library\/VirtualFolders failed/i,
    );
  });

  it("when POST /Library/VirtualFolders succeeds then it sends correct body and query params", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);
    const body: AddVirtualFolderDtoSchema = {
      LibraryOptions: {
        PathInfos: [{ Path: "/data/movies" }],
      } as LibraryOptionsSchema,
    };

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.addVirtualFolder("Test Movies", "movies", body);

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Library\/VirtualFolders/);
    expect(req.url).toContain("name=Test%20Movies");
    expect(req.url).toContain("collectionType=movies");
    expect(req.url).toContain("refreshLibrary=true");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("LibraryOptions");
    expect(bodyText).toContain("/data/movies");
  });

  it("when POST /Library/VirtualFolders fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));

    const body: AddVirtualFolderDtoSchema = {
      LibraryOptions: {
        PathInfos: [{ Path: "/data/test" }],
      } as LibraryOptionsSchema,
    };

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(
      jellyfinClient.addVirtualFolder("Test", "movies", body),
    ).rejects.toThrow(/POST \/Library\/VirtualFolders failed/i);
  });
});

describe("api/jf Encoding façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /System/Configuration/Encoding returns JSON then it returns the parsed object", async (): Promise<void> => {
    // Arrange
    const payload: EncodingOptionsSchema = {
      EnableHardwareEncoding: true,
      EnableTonemapping: false,
      HlsAudioSeekStrategy: "TrimCopiedAudio",
    };
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: EncodingOptionsSchema =
      await jellyfinClient.getEncodingConfiguration();

    // Assert
    expect(out).toEqual(payload);

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/System\/Configuration\/encoding$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when POST /System/Configuration/Encoding succeeds then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    mockFetchJson({});

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.updateEncodingConfiguration({
      EnableHardwareEncoding: true,
    });

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Configuration\/encoding$/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("EnableHardwareEncoding");
  });

  it("when GET /System/Configuration/Encoding fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getEncodingConfiguration()).rejects.toThrow(
      /GET \/System\/Configuration\/encoding failed/i,
    );
  });

  it("when POST /System/Configuration/Encoding fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 400 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(
      jellyfinClient.updateEncodingConfiguration({}),
    ).rejects.toThrow(/POST \/System\/Configuration\/encoding failed/i);
  });
});

describe("api/jf Metadata façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("gets the metadata configuration", async (): Promise<void> => {
    const payload: MetadataConfigurationSchema = {
      UseFileCreationTimeForDateAdded: true,
    };
    mockFetchJson(payload);
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    const result: MetadataConfigurationSchema =
      await jellyfinClient.getMetadataConfiguration();

    expect(result).toEqual(payload);
    const request: Request = getLastRequest();
    expect(request.method).toBe("GET");
    expect(request.url).toMatch(/\/System\/Configuration\/metadata$/);
  });

  it("reads and writes the xbmcmetadata named configuration", async (): Promise<void> => {
    mockFetchJson({ ReleaseDateFormat: "yyyy" });
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.getXbmcMetadataConfiguration();
    expect(getLastRequest().url).toMatch(
      /\/System\/Configuration\/xbmcmetadata$/,
    );

    mockFetchNoContent();
    await jellyfinClient.updateXbmcMetadataConfiguration({
      ReleaseDateFormat: "yyyy-MM-dd",
    });
    const request: Request = getLastRequest();
    expect(request.method).toBe("POST");
    expect(request.url).toMatch(/\/System\/Configuration\/xbmcmetadata$/);
  });

  it("enables and disables a plugin by id and version", async (): Promise<void> => {
    mockFetchNoContent();
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.enablePlugin("abc", "1.2.3.4");
    expect(getLastRequest().method).toBe("POST");
    expect(getLastRequest().url).toMatch(/\/Plugins\/abc\/1\.2\.3\.4\/Enable$/);
    await jellyfinClient.disablePlugin("abc", "1.2.3.4");
    expect(getLastRequest().url).toMatch(
      /\/Plugins\/abc\/1\.2\.3\.4\/Disable$/,
    );
  });

  it("updates the metadata configuration", async (): Promise<void> => {
    mockFetchNoContent();
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    await jellyfinClient.updateMetadataConfiguration({
      UseFileCreationTimeForDateAdded: false,
    });

    const request: Request = getLastRequest();
    expect(request.method).toBe("POST");
    expect(request.url).toMatch(/\/System\/Configuration\/metadata$/);
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(await request.json()).toEqual({
      UseFileCreationTimeForDateAdded: false,
    });
  });

  it("reports a failed metadata configuration read", async (): Promise<void> => {
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    await expect(jellyfinClient.getMetadataConfiguration()).rejects.toThrow(
      /GET \/System\/Configuration\/metadata failed/i,
    );
  });

  it("reports a failed metadata configuration update", async (): Promise<void> => {
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 400 }));
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    await expect(
      jellyfinClient.updateMetadataConfiguration({}),
    ).rejects.toThrow(/POST \/System\/Configuration\/metadata failed/i);
  });
});

describe("api/jf Splashscreen", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /Branding/Splashscreen returns an image then it returns the raw bytes", async (): Promise<void> => {
    fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const out: Uint8Array = await createJellyfinClient(
      baseUrl,
      apiKey,
    ).getSplashscreen();

    expect(Array.from(out)).toEqual([1, 2, 3]);
    expect(getLastRequest().url).toMatch(/\/Branding\/Splashscreen$/);
  });

  it("when GET /Branding/Splashscreen is 404 then no custom image is set", async (): Promise<void> => {
    mockFetchNoContent(404);

    const out: Uint8Array = await createJellyfinClient(
      baseUrl,
      apiKey,
    ).getSplashscreen();

    expect(out).toHaveLength(0);
  });

  it("when uploading then it POSTs the base64 text as an image body", async (): Promise<void> => {
    mockFetchNoContent();

    await createJellyfinClient(baseUrl, apiKey).uploadSplashscreen(
      new Uint8Array([1, 2, 3]),
    );

    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Branding\/Splashscreen$/);
    expect(req.headers.get("content-type")).toBe("image/png");
    expect(await req.text()).toBe("AQID");
  });

  it("when reading the server spec then it GETs /api-docs/openapi.json", async (): Promise<void> => {
    mockFetchJson({ components: { schemas: {} } });

    const out: unknown = await createJellyfinClient(
      baseUrl,
      apiKey,
    ).getServerSpec();

    expect(out).toEqual({ components: { schemas: {} } });
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(
      /\/api-docs\/openapi\.json$/,
    );
  });

  it("when deleting then it sends DELETE /Branding/Splashscreen", async (): Promise<void> => {
    mockFetchNoContent();

    await createJellyfinClient(baseUrl, apiKey).deleteSplashscreen();

    const req: Request = getLastRequest();
    expect(req.method).toBe("DELETE");
    expect(req.url).toMatch(/\/Branding\/Splashscreen$/);
  });

  it("when the delete is rejected then it throws with the status", async (): Promise<void> => {
    mockFetchNoContent(403);

    await expect(
      createJellyfinClient(baseUrl, apiKey).deleteSplashscreen(),
    ).rejects.toThrow(/DELETE \/Branding\/Splashscreen failed: 403/);
  });

  it("when the upload is rejected then it throws with the status", async (): Promise<void> => {
    mockFetchNoContent(400);

    await expect(
      createJellyfinClient(baseUrl, apiKey).uploadSplashscreen(
        new Uint8Array([1]),
      ),
    ).rejects.toThrow(/POST \/Branding\/Splashscreen failed: 400/);
  });
});

describe("api/jf Branding façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /Branding/Configuration returns JSON then it returns the parsed object", async (): Promise<void> => {
    // Arrange
    const payload: BrandingOptionsDtoSchema = {
      LoginDisclaimer: "Welcome to our server",
      CustomCss: "body { background: blue; }",
      SplashscreenEnabled: true,
    } as BrandingOptionsDtoSchema;
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: BrandingOptionsDtoSchema =
      await jellyfinClient.getBrandingConfiguration();

    // Assert
    expect(out).toEqual(payload);

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/Branding\/Configuration$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when POST /System/Configuration/Branding succeeds then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    mockFetchJson({});

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.updateBrandingConfiguration({
      LoginDisclaimer: "New disclaimer",
      SplashscreenEnabled: false,
    });

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Configuration\/Branding$/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("LoginDisclaimer");
    expect(bodyText).toContain("SplashscreenEnabled");
  });

  it("when GET /Branding/Configuration fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 403 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getBrandingConfiguration()).rejects.toThrow(
      /GET \/Branding\/Configuration failed/i,
    );
  });

  it("when POST /System/Configuration/Branding fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 422 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(
      jellyfinClient.updateBrandingConfiguration({}),
    ).rejects.toThrow(/POST \/System\/Configuration\/Branding failed/i);
  });
});

describe("api/jf Users façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /Users returns JSON then it returns the parsed array", async (): Promise<void> => {
    // Arrange
    const payload: UserDtoSchema[] = [
      {
        Name: "admin",
        Id: "user1-id",
        ServerId: "server-id",
        HasConfiguredPassword: true,
      },
      {
        Name: "testuser",
        Id: "user2-id",
        ServerId: "server-id",
        HasConfiguredPassword: true,
      },
    ] as UserDtoSchema[];
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: UserDtoSchema[] = await jellyfinClient.getUsers();

    // Assert
    expect(out).toEqual(payload);
    expect(out).toHaveLength(2);
    expect(out[0].Name).toBe("admin");
    expect(out[1].Name).toBe("testuser");

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/Users$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when GET /Users returns empty array then it returns empty array", async (): Promise<void> => {
    // Arrange
    mockFetchJson([]);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: UserDtoSchema[] = await jellyfinClient.getUsers();

    // Assert
    expect(out).toEqual([]);
    expect(out).toHaveLength(0);
  });

  it("when POST /Users/New succeeds then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    const responsePayload: UserDtoSchema = {
      Name: "newuser",
      Id: "new-user-id",
      ServerId: "server-id",
    } as UserDtoSchema;
    mockFetchJson(responsePayload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const createBody: CreateUserByNameSchema = {
      Name: "newuser",
      Password: "testpass",
    };
    await jellyfinClient.createUser(createBody);

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Users\/New$/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("newuser");
    expect(bodyText).toContain("testpass");
  });

  it("getDisplayPreferences reads the jellarr preferences of the user", async () => {
    mockFetchJson({ CustomPrefs: { "jellarr.disabledAt": "x" } });
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: { CustomPrefs?: Record<string, string | null> } =
      await jellyfinClient.getDisplayPreferences("u1");
    expect(out.CustomPrefs?.["jellarr.disabledAt"]).toBe("x");
    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(
      /\/DisplayPreferences\/jellarr\?userId=u1&client=jellarr$/,
    );
  });
  it("display preferences are read and written under the given id and client", async () => {
    mockFetchJson({ CustomPrefs: { theme: "dark" } });
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.getDisplayPreferences("u1", "usersettings", "emby");
    expect(getLastRequest().url).toMatch(
      /\/DisplayPreferences\/usersettings\?userId=u1&client=emby$/,
    );
    mockFetchNoContent();
    await jellyfinClient.updateDisplayPreferences(
      "u1",
      { CustomPrefs: { theme: "light" } },
      "usersettings",
      "emby",
    );
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(
      /\/DisplayPreferences\/usersettings\?userId=u1&client=emby$/,
    );
  });

  it("renameVirtualFolder posts the old and new names", async () => {
    mockFetchNoContent();
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.renameVirtualFolder("Films", "Movies");
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(
      /\/Library\/VirtualFolders\/Name\?name=Films&newName=Movies&refreshLibrary=false$/,
    );
  });

  it("when GET /Users fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 401 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getUsers()).rejects.toThrow(
      /GET \/Users failed/i,
    );
  });

  it("when POST /Users/New fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 409 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const createBody: CreateUserByNameSchema = {
      Name: "duplicate",
      Password: "test",
    };

    // Assert
    await expect(jellyfinClient.createUser(createBody)).rejects.toThrow(
      /POST \/Users\/New failed/i,
    );
  });

  it("when POST /Users/{userId}/Policy succeeds then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const policyBody: UserPolicySchema = {
      IsAdministrator: true,
      LoginAttemptsBeforeLockout: 5,
    } as UserPolicySchema;
    await jellyfinClient.updateUserPolicy("user-id-123", policyBody);

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Users\/user-id-123\/Policy/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("IsAdministrator");
    expect(bodyText).toContain("LoginAttemptsBeforeLockout");
  });

  it("when POST /Users/{userId}/Policy fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 400 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const policyBody: UserPolicySchema = {
      IsAdministrator: false,
    } as UserPolicySchema;

    // Assert
    await expect(
      jellyfinClient.updateUserPolicy("user-id-123", policyBody),
    ).rejects.toThrow(/POST \/Users\/\{userId\}\/Policy failed/i);
  });
});

describe("api/jf Startup façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when POST /Startup/Complete succeeds then it resolves", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.completeStartupWizard();

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Startup\/Complete$/);
    expect(req.headers.get("Authorization")).not.toContain("Token=");
  });

  it("when POST /Startup/Complete fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 500 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.completeStartupWizard()).rejects.toThrow(
      /POST \/Startup\/Complete failed/i,
    );
  });
});

describe("api/jf Plugins façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /Plugins returns JSON then it returns the parsed array", async (): Promise<void> => {
    // Arrange
    const payload: PluginInfoSchema[] = [
      {
        Name: "Trakt",
        Version: "26.0.0",
        Id: "plugin-id-1",
        Status: "Active",
      },
      {
        Name: "Playback Reporting",
        Version: "10.0.0",
        Id: "plugin-id-2",
        Status: "Active",
      },
    ] as PluginInfoSchema[];
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: PluginInfoSchema[] = await jellyfinClient.getPlugins();

    // Assert
    expect(out).toEqual(payload);
    expect(out).toHaveLength(2);
    expect(out[0].Name).toBe("Trakt");
    expect(out[1].Name).toBe("Playback Reporting");

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/Plugins$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when GET /Plugins returns empty array then it returns empty array", async (): Promise<void> => {
    // Arrange
    mockFetchJson([]);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: PluginInfoSchema[] = await jellyfinClient.getPlugins();

    // Assert
    expect(out).toEqual([]);
    expect(out).toHaveLength(0);
  });

  it("when GET /Plugins fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 401 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getPlugins()).rejects.toThrow(
      /GET \/Plugins failed/i,
    );
  });

  it("when POST /Packages/Installed/{name} succeeds then it resolves", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.installPackage("Trakt");

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Packages\/Installed\/Trakt$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when POST /Packages/Installed/{name} with spaces succeeds then it URL-encodes the name", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.installPackage("Playback Reporting");

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Packages\/Installed\/Playback%20Reporting$/);
  });

  it("when POST /Packages/Installed/{name} has options then it sends them as query parameters", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.installPackage("SSO Authentication", {
      assemblyGuid: "505ce9d1-d916-42fa-86ca-673ef241d7df",
      version: "5.1.1",
      repositoryUrl: "https://example.invalid/manifest.json",
    });

    // Assert
    const url: URL = new URL(getLastRequest().url);
    expect(url.pathname).toBe("/Packages/Installed/SSO%20Authentication");
    expect(url.searchParams.get("assemblyGuid")).toBe(
      "505ce9d1-d916-42fa-86ca-673ef241d7df",
    );
    expect(url.searchParams.get("version")).toBe("5.1.1");
    expect(url.searchParams.get("repositoryUrl")).toBe(
      "https://example.invalid/manifest.json",
    );
  });

  it("when DELETE /Plugins/{pluginId}/{version} succeeds then it resolves", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    await jellyfinClient.uninstallPlugin("abc", "4.0.0.4");

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("DELETE");
    expect(req.url).toMatch(/\/Plugins\/abc\/4\.0\.0\.4$/);
  });

  it("when GET /Packages returns JSON then it returns the catalog", async (): Promise<void> => {
    // Arrange
    mockFetchJson([{ name: "Trakt", guid: "abc", versions: [] }]);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: PackageInfoSchema[] = await jellyfinClient.getPackages();

    // Assert
    expect(out).toEqual([{ name: "Trakt", guid: "abc", versions: [] }]);
    expect(getLastRequest().url).toMatch(/\/Packages$/);
  });

  it("when GET /System/Info reports HasPendingRestart then getPendingRestart returns it", async (): Promise<void> => {
    // Arrange
    mockFetchJson({ Version: "12.2.0", HasPendingRestart: true });

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getPendingRestart()).resolves.toBe(true);
    expect(getLastRequest().url).toMatch(/\/System\/Info$/);
  });

  it("when GET /System/Info returns a version then it returns it", async (): Promise<void> => {
    // Arrange
    mockFetchJson({ Version: "12.2.0" });

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getServerVersion()).resolves.toBe("12.2.0");
    expect(getLastRequest().url).toMatch(/\/System\/Info$/);
  });

  it("when GET /System/Info is unauthorized with an empty body then it throws", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(401);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.getServerVersion()).rejects.toThrow(
      /GET \/System\/Info failed: 401/,
    );
  });

  it("when POST /Packages/Installed/{name} fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 404 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(jellyfinClient.installPackage("NonExistent")).rejects.toThrow(
      /POST \/Packages\/Installed\/NonExistent failed/i,
    );
  });

  it("when GET /Plugins/{pluginId}/Configuration returns JSON then it returns the parsed object", async (): Promise<void> => {
    // Arrange
    const payload: BasePluginConfigurationSchema = {
      TraktUsers: [{ ExtraLogging: false, Scrobble: true }],
    } as unknown as BasePluginConfigurationSchema;
    mockFetchJson(payload);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const out: BasePluginConfigurationSchema =
      await jellyfinClient.getPluginConfiguration("plugin-id-123");

    // Assert
    expect(out).toEqual(payload);

    const req: Request = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/Plugins\/plugin-id-123\/Configuration$/);
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);
  });

  it("when GET /Plugins/{pluginId}/Configuration fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 404 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Assert
    await expect(
      jellyfinClient.getPluginConfiguration("nonexistent-id"),
    ).rejects.toThrow(/GET \/Plugins\/nonexistent-id\/Configuration failed/i);
  });

  it("when POST /Plugins/{pluginId}/Configuration succeeds then it sends JSON body and resolves", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const configBody: BasePluginConfigurationSchema = {
      TraktUsers: [{ ExtraLogging: true, Scrobble: false }],
    } as unknown as BasePluginConfigurationSchema;
    await jellyfinClient.updatePluginConfiguration("plugin-id-123", configBody);

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Plugins\/plugin-id-123\/Configuration$/);
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(req.headers.get("Authorization")).toContain(`Token="${apiKey}"`);

    const bodyText: string = await req.text();
    expect(bodyText).toContain("TraktUsers");
    expect(bodyText).toContain("ExtraLogging");
  });

  it("when POST /Plugins/{pluginId}/Configuration fails then it throws an error with status", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("boom", { status: 400 }));

    // Act
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );
    const configBody: BasePluginConfigurationSchema =
      {} as BasePluginConfigurationSchema;

    // Assert
    await expect(
      jellyfinClient.updatePluginConfiguration("plugin-id-123", configBody),
    ).rejects.toThrow(/POST \/Plugins\/plugin-id-123\/Configuration failed/i);
  });
  it("when a write fails with an empty body then it still throws", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(401);
    const jellyfinClient: JellyfinClient = createJellyfinClient(
      baseUrl,
      apiKey,
    );

    // Act & Assert
    await expect(
      jellyfinClient.updateLibraryOptions("lib-1", {}),
    ).rejects.toThrow(/LibraryOptions failed: 401/i);
    await expect(
      jellyfinClient.updateMetadataConfiguration({}),
    ).rejects.toThrow(/metadata failed: 401/i);
  });
});

describe("api/jf startup and sign-in façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
  });

  it("when GET /System/Info/Public returns JSON then StartupWizardCompleted is exposed", async (): Promise<void> => {
    // Arrange
    mockFetchJson({ StartupWizardCompleted: false });

    // Act
    const info: { StartupWizardCompleted?: boolean | null } =
      await createJellyfinClient(baseUrl).getPublicSystemInfo();

    // Assert
    expect(info.StartupWizardCompleted).toBe(false);
    expect(getLastRequest().headers.get("Authorization")).not.toContain(
      "Token=",
    );
  });

  it.each([
    ["updateStartupConfiguration", "POST", /\/Startup\/Configuration$/],
    ["updateStartupUser", "POST", /\/Startup\/User$/],
    ["setRemoteAccess", "POST", /\/Startup\/RemoteAccess$/],
    ["getStartupUser", "GET", /\/Startup\/User$/],
  ] as const)(
    "when %s is called then it sends %s to the right path and throws on failure",
    async (method: string, verb: string, pattern: RegExp): Promise<void> => {
      // Arrange
      mockFetchNoContent(204);
      const jf: Record<string, (body?: unknown) => Promise<void>> =
        createJellyfinClient(baseUrl) as unknown as Record<
          string,
          (body?: unknown) => Promise<void>
        >;

      // Act
      await jf[method]({ Name: "x", EnableRemoteAccess: true });

      // Assert
      const req: Request = getLastRequest();
      expect(req.method).toBe(verb);
      expect(req.url).toMatch(pattern);

      // Arrange failure
      mockFetchNoContent(500);
      await expect(jf[method]({})).rejects.toThrow(/failed: 500/);
    },
  );

  it("when AuthenticateByName succeeds then it returns the token and posts the credentials", async (): Promise<void> => {
    // Arrange
    mockFetchJson({ AccessToken: "tok-1" });

    // Act
    const token: string = await createJellyfinClient(
      baseUrl,
    ).authenticateByName("root", "pw");

    // Assert
    expect(token).toBe("tok-1");
    const req: Request = getLastRequest();
    expect(req.url).toMatch(/\/Users\/AuthenticateByName$/);
    expect(await req.clone().json()).toEqual({ Username: "root", Pw: "pw" });
  });

  it("when AuthenticateByName is rejected then the error carries the status", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(401);

    // Act + Assert
    await expect(
      createJellyfinClient(baseUrl).authenticateByName("root", "bad"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("when a token is set after construction then later requests use it", async (): Promise<void> => {
    // Arrange
    mockFetchJson({});
    const jf: JellyfinClient = createJellyfinClient(baseUrl, "old");

    // Act
    jf.setAccessToken("new");
    await jf.getSystemConfiguration();

    // Assert
    expect(getLastRequest().headers.get("Authorization")).toContain(
      'Token="new"',
    );
  });
});

describe("api/jf password façade", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
  });

  it("when POST /Users/Password is sent then userId is a query parameter and only NewPw is in the body", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    await createJellyfinClient(baseUrl, apiKey).updateUserPassword(
      "user-1",
      "pw",
    );

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/Users\/Password\?userId=user-1$/);
    expect(await req.clone().json()).toEqual({ NewPw: "pw" });
  });

  it("when POST /Users/Password fails then it throws with the status", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(403);

    // Act + Assert
    await expect(
      createJellyfinClient(baseUrl, apiKey).updateUserPassword("u", "p"),
    ).rejects.toThrow(/failed: 403/);
  });

  it("when the probe sign-in succeeds then it uses its own device id and signs the probe out", async (): Promise<void> => {
    // Arrange
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ AccessToken: "probe-tok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    // Act
    const result: string = await createJellyfinClient(
      baseUrl,
      apiKey,
    ).checkUserPassword("alice", "pw");

    // Assert
    expect(result).toBe("valid");
    const login: Request = fetchMock.mock.calls[0]?.[0] as Request;
    const logout: Request = fetchMock.mock.calls[1]?.[0] as Request;
    expect(login.headers.get("Authorization")).toContain(
      'DeviceId="jellarr-password-check"',
    );
    expect(login.headers.get("Authorization")).not.toContain("Token=");
    expect(logout.url).toMatch(/\/Sessions\/Logout$/);
    expect(logout.headers.get("Authorization")).toContain('Token="probe-tok"');
  });

  it("when the probe logout fails then it warns and still reports valid", async (): Promise<void> => {
    // Arrange
    const warn: Mock = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ AccessToken: "probe-tok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockRejectedValueOnce(new Error("socket hang up"));

    // Act
    const result: string = await createJellyfinClient(
      baseUrl,
      apiKey,
    ).checkUserPassword("alice", "pw");

    // Assert
    expect(result).toBe("valid");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not sign out the password-check session"),
    );
  });

  it.each([
    [401, "invalid"],
    [403, "unverifiable"],
  ])(
    "when the probe sign-in answers %s then the check is %s",
    async (status: number, expected: string): Promise<void> => {
      // Arrange
      mockFetchNoContent(status);

      // Act + Assert
      expect(
        await createJellyfinClient(baseUrl, apiKey).checkUserPassword(
          "alice",
          "pw",
        ),
      ).toBe(expected);
    },
  );

  it("when the probe sign-in answers 500 then it throws instead of guessing", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(500);

    // Act + Assert
    await expect(
      createJellyfinClient(baseUrl, apiKey).checkUserPassword("alice", "pw"),
    ).rejects.toThrow(/failed: 500/);
  });
});

describe("api/jf restart façade", () => {
  it("when POST /System/Restart succeeds then it returns", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(204);

    // Act
    await createJellyfinClient(baseUrl, apiKey).restartServer();

    // Assert
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Restart$/);
  });

  it("when POST /System/Restart fails then it throws with the status", async (): Promise<void> => {
    // Arrange
    mockFetchNoContent(403);

    // Act + Assert
    await expect(
      createJellyfinClient(baseUrl, apiKey).restartServer(),
    ).rejects.toThrow(/POST \/System\/Restart failed: 403/);
  });
});

describe("api/jf Live TV", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
  });

  it("reads and writes the named livetv configuration", async (): Promise<void> => {
    mockFetchJson({ GuideDays: 5 });
    const jf: JellyfinClient = createJellyfinClient(baseUrl, apiKey);

    expect(await jf.getLiveTvOptions()).toEqual({ GuideDays: 5 });
    expect(getLastRequest().url).toMatch(/\/System\/Configuration\/livetv$/);

    mockFetchNoContent();
    await jf.updateLiveTvOptions({ GuideDays: 7 });
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/System\/Configuration\/livetv$/);
    expect(await req.json()).toEqual({ GuideDays: 7 });
  });

  it("saves and deletes tuner hosts", async (): Promise<void> => {
    mockFetchJson({});
    const jf: JellyfinClient = createJellyfinClient(baseUrl, apiKey);
    await jf.saveTunerHost({ Type: "m3u", Url: "http://tv" });
    const save: Request = getLastRequest();
    expect(save.method).toBe("POST");
    expect(save.url).toMatch(/\/LiveTv\/TunerHosts$/);
    expect(await save.json()).toEqual({ Type: "m3u", Url: "http://tv" });

    mockFetchNoContent();
    await jf.deleteTunerHost("h1");
    const del: Request = getLastRequest();
    expect(del.method).toBe("DELETE");
    expect(del.url).toMatch(/\/LiveTv\/TunerHosts\?id=h1$/);
  });

  it("sends a listings password as the pw query and never in the body", async (): Promise<void> => {
    mockFetchJson({});
    const jf: JellyfinClient = createJellyfinClient(baseUrl, apiKey);
    await jf.saveListingProvider({ Type: "SchedulesDirect" }, "s3cret");
    const save: Request = getLastRequest();
    expect(save.url).toMatch(/\/LiveTv\/ListingProviders\?pw=s3cret$/);
    expect(await save.text()).not.toContain("s3cret");

    mockFetchNoContent();
    await jf.deleteListingProvider("p1");
    expect(getLastRequest().url).toMatch(/\/LiveTv\/ListingProviders\?id=p1$/);
  });

  it("throws with the status when a call fails", async (): Promise<void> => {
    mockFetchNoContent(403);
    await expect(
      createJellyfinClient(baseUrl, apiKey).saveTunerHost({}),
    ).rejects.toThrow(/POST \/LiveTv\/TunerHosts failed: 403/);
  });
});

describe("api/jf library media paths", () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
  });

  it("adds a path without refreshing the library", async (): Promise<void> => {
    mockFetchNoContent();
    await createJellyfinClient(baseUrl, apiKey).addMediaPath("Movies", "/m");
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(
      /\/Library\/VirtualFolders\/Paths\?refreshLibrary=false$/,
    );
    expect(await req.json()).toEqual({
      Name: "Movies",
      PathInfo: { Path: "/m" },
    });
  });

  it("removes a path without refreshing the library", async (): Promise<void> => {
    mockFetchNoContent();
    await createJellyfinClient(baseUrl, apiKey).removeMediaPath("Movies", "/m");
    const req: Request = getLastRequest();
    expect(req.method).toBe("DELETE");
    const url: URL = new URL(req.url);
    expect(url.pathname).toBe("/Library/VirtualFolders/Paths");
    expect(url.searchParams.get("name")).toBe("Movies");
    expect(url.searchParams.get("path")).toBe("/m");
    expect(url.searchParams.get("refreshLibrary")).toBe("false");
  });

  it("throws with the status when a call fails", async (): Promise<void> => {
    mockFetchNoContent(500);
    await expect(
      createJellyfinClient(baseUrl, apiKey).removeMediaPath("Movies", "/m"),
    ).rejects.toThrow(/DELETE \/Library\/VirtualFolders\/Paths failed: 500/);
  });

  it("deletes a user, a library, an API key and reads the current user", async (): Promise<void> => {
    mockFetchNoContent();
    const jf: JellyfinClient = createJellyfinClient(baseUrl, apiKey);
    await jf.deleteUser("u-1");
    expect(getLastRequest().method).toBe("DELETE");
    expect(getLastRequest().url).toMatch(/\/Users\/u-1$/);

    await jf.deleteVirtualFolder('Odd "name"');
    expect(getLastRequest().method).toBe("DELETE");
    expect(new URL(getLastRequest().url).pathname).toBe(
      "/Library/VirtualFolders",
    );
    expect(new URL(getLastRequest().url).searchParams.get("name")).toBe(
      'Odd "name"',
    );

    await jf.deleteApiKey("tok/en");
    expect(getLastRequest().method).toBe("DELETE");
    expect(new URL(getLastRequest().url).pathname).toBe("/Auth/Keys/tok%2Fen");

    mockFetchNoContent(500);
    await expect(jf.deleteUser("u-1")).rejects.toThrow(
      /DELETE \/Users\/u-1 failed: 500/,
    );

    mockFetchJson({ Name: "root" });
    expect(await jf.getCurrentUser()).toEqual({ Name: "root" });
    mockFetchNoContent(400);
    expect(await jf.getCurrentUser()).toBeUndefined();
    mockFetchNoContent(401);
    await expect(jf.getCurrentUser()).rejects.toThrow(/401/);
  });

  it("reads scheduled tasks and replaces a task's triggers", async (): Promise<void> => {
    mockFetchJson([{ Id: "t1", Key: "RefreshLibrary" }]);
    const jf: JellyfinClient = createJellyfinClient(baseUrl, apiKey);
    expect(await jf.getScheduledTasks()).toEqual([
      { Id: "t1", Key: "RefreshLibrary" },
    ]);

    mockFetchNoContent();
    await jf.updateTaskTriggers("t1", [{ Type: "StartupTrigger" }]);
    const req: Request = getLastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/ScheduledTasks\/t1\/Triggers$/);
    expect(await req.json()).toEqual([{ Type: "StartupTrigger" }]);
  });
});
