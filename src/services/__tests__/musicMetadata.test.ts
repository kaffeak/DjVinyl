import {fetchAlbumMetadata} from "@/src/services/musicMetadata";

const orginalFetch = globalThis.fetch;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchAlbumMetadata", () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.useFakeTimers();

    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = orginalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("should fetch artwork and correctly formatted tracks", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release/?")){
        return mockResponse({
          releases: [
            { id: "release-123" }
          ],
        });
      }

      if (url.includes("/ws/2/release/release-123?")) {
        return mockResponse({
          media: [
            {
              tracks: [
                {
                  title: "We Rock",
                  length: 275000,
                },
              ],
            },
          ],
        });
      }

      if (url.startsWith("https://coverartarchive.org/release/release-123/")) {
        return mockResponse({
          images: [
            {
              front: true,
              image: "https://example.com/cover.jpg",
              thumbnails: {
                "250": "https://example.com/cover.jpg",
                "500": "https://example.com/cover.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("The Last in Line", "Dio");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: "https://example.com/cover.jpg",
      trackList: ["We Rock - 4:35"],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("should retry three times when MusicBrainz returns 503", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({}, 503)
    );

    const resultPromise = fetchAlbumMetadata("Test Album", "Test Artist");

    const assertion = expect(resultPromise).rejects.toThrow("MusicBrainz search failed: 503");

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("should return coverUrl as null and trackList as an empty array", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({releases: []})
    );

    const resultPromise = fetchAlbumMetadata("Test Album", "Test Artist");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: null,
      trackList: [],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should format tracks using nested recording metadata", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release/?")) {
        return mockResponse({
          releases: [{ id: "release-123" }],
        });
      }

      if (url.includes("/ws/2/release/release-123?")) {
        return mockResponse({
          media: [
            {
              tracks: [
                {
                  recording: {
                    title: "We Rock",
                    length: 275000,
                  },
                },
              ],
            },
          ],
        });
      }

      if (url.includes("coverartarchive.org/release/release-123")) {
        return mockResponse({
          images: [],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("The Last in Line", "Dio");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: null,
      trackList: ["We Rock - 4:35"],
    });

    await jest.runAllTimersAsync();
    await assertion;
  });
});