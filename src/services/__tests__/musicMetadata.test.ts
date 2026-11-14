import {fetchAlbumArtwork, fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {selectBestRelease} from "@/src/utils/releaseMatching";

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
      backCoverUrl: null,
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
      backCoverUrl: null,
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
      backCoverUrl: null,
      trackList: ["We Rock - 4:35"],
    });

    await jest.runAllTimersAsync();
    await assertion;
  });

  test("should fetch metadata from the best matching release", async () => {
    const fetchReturn = {
      releases: [
        {
          id: "cd-release",
          title: "The Last in Line",
          "artist-credit": [{ name: "Dio" }],
          media: [{ format: "CD" }],
        },
        {
          id: "vinyl-release",
          title: "The Last in Line",
          "artist-credit": [{ name: "Dio" }],
          media: [{ format: "Vinyl" }],
        },
      ]
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release/?")) {
        return mockResponse(fetchReturn);
      }

      if (url.includes("/ws/2/release/vinyl-release?")) {
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

      if (url.startsWith("https://coverartarchive.org/release/vinyl-release/")) {
        return mockResponse({
          images: [
            {
              front: true,
              thumbnails: {
                "500": "https://example.com/vinyl-cover.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("The Last in Line", "Dio");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: "https://example.com/vinyl-cover.jpg",
      backCoverUrl: null,
      trackList: ["We Rock - 4:35"],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(requestedUrls.some((url) => url.includes("/ws/2/release/vinyl-release?"))).toBe(true);

    expect(requestedUrls.some((url) => url.includes("/ws/2/release/cd-release?"))).toBe(false);
  });

  test("should fetch both front and back artwork", async () => {
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
              back: false,
              thumbnails: {
                "500": "https://example.com/front.jpg",
              },
            },
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("The Last in Line", "Dio");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
      trackList: ["We Rock - 4:35"],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("should select a vinyl release with front and back artwork", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [
            {
              id: "cd-with-art",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              media: [{ format: "CD" }],
              "cover-art-archive": {
                artwork: true,
                front: true,
                back: true,
              },
            },
            {
              id: "vinyl-with-art",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              media: [{ format: '12" Vinyl' }],
              "cover-art-archive": {
                artwork: true,
                front: true,
                back: true,
              },
            },
          ],
        });
      }

      if (url.includes("/ws/2/release/?")) {
        return mockResponse({
          releases: [
            {
              id: "vinyl-no-art",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              "release-group": { id: "group-123" },
              media: [{ format: "Vinyl" }],
              score: "100",
            },
          ],
        });
      }

      if (url.includes("/ws/2/release/vinyl-with-art?")) {
        return mockResponse({
          media: [
            {
              tracks: [
                {
                  title: "The Ides of March",
                  length: 106133,
                },
              ],
            },
          ],
        });
      }

      if (
        url.includes(
          "coverartarchive.org/release/vinyl-with-art/"
        )
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              back: false,
              thumbnails: {
                "500": "https://example.com/front.jpg",
              },
            },
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("Killers", "Iron Maiden");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
      trackList: ["The Ides of March - 1:46"],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(requestedUrls.some((url) => url.includes("/ws/2/release/vinyl-no-art?"))).toBe(false);

    expect(requestedUrls.some((url) => url.includes("/ws/2/release/vinyl-with-art?"))).toBe(true);
  });

  test("should fall back to the search-selected release when browsing fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("release-group=group-123")) {
        return mockResponse({}, 503);
      }

      if (url.includes("/ws/2/release/?")) {
        return mockResponse({
          releases: [
            {
              id: "original-release",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              "release-group": { id: "group-123" },
              media: [{ format: "Vinyl" }],
              score: "100",
            },
          ],
        });
      }

      if (url.includes("/ws/2/release/original-release?")) {
        return mockResponse({
          media: [
            {
              tracks: [
                {
                  title: "The Ides of March",
                  length: 106133,
                },
              ],
            },
          ],
        });
      }

      if (
        url.includes(
          "coverartarchive.org/release/original-release/"
        )
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              back: false,
              thumbnails: {
                "500": "https://example.com/front.jpg",
              },
            },
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumMetadata("Killers", "Iron Maiden");

    const assertion = expect(resultPromise).resolves.toEqual({
      coverUrl: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
      trackList: ["The Ides of March - 1:46"],
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(6);

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    const browseRequests = requestedUrls.filter((url) => url.includes("release-group=group-123"));

    expect(browseRequests).toHaveLength(3);

    expect(requestedUrls.some((url) => url.includes("/ws/2/release/original-release?"))).toBe(true);

    expect(requestedUrls.some((url) => url.includes("coverartarchive.org/release/original-release/"))).toBe(true);
  });

  test("should skip artwork lookup when both covers exist", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
    };

    const result = await fetchAlbumArtwork(album);

    expect(result).toEqual({
      candidate: null,
      artwork: {
        coverUrl: null,
        backCoverUrl: null,
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("should fetch both covers for an incomplete album", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/old-front.jpg",
      backCoverUrl: "",
    };

    const selectedRelease = {
      id: "vinyl-with-art",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl'}],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [selectedRelease],
        });
      }

      if (url.includes("/ws/2/release/?")) {
        return mockResponse({
          releases: [
            {
              id: "vinyl-no-art",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              "release-group": { id: "group-123" },
              media: [{ format: "Vinyl" }],
              score: "100",
            },
          ],
        });
      }

      if (
        url.includes(
          "coverartarchive.org/release/vinyl-with-art/"
        )
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              back: false,
              thumbnails: {
                "500": "https://example.com/new-front.jpg",
              },
            },
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/new-back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumArtwork(album);

    const assertion = expect(resultPromise).resolves.toEqual({
      candidate: {
        kind: "pair",
        release: selectedRelease,
      },
      artwork: {
        coverUrl: "https://example.com/new-front.jpg",
        backCoverUrl: "https://example.com/new-back.jpg",
      },
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(requestedUrls.some((url) => url.includes("inc=recordings"))).toBe(false);
  });

  test("should fetch a back-only release when a front cover already exists", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/existing-front.jpg",
      backCoverUrl: "",
    };

    const selectedRelease = {
      id: "vinyl-with-art",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl'}],
      "cover-art-archive": {
        artwork: true,
        front: false,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [selectedRelease],
        });
      }

      if (url.includes("/ws/2/release/?")) {
        return mockResponse({
          releases: [
            {
              id: "vinyl-no-art",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              "release-group": { id: "group-123" },
              media: [{ format: "Vinyl" }],
              score: "100",
            },
          ],
        });
      }

      if (
        url.includes(
          "coverartarchive.org/release/vinyl-with-art/"
        )
      ) {
        return mockResponse({
          images: [
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/new-back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumArtwork(album);

    const assertion = expect(resultPromise).resolves.toEqual({
      candidate: {
        kind: "back-only",
        release: selectedRelease,
      },
      artwork: {
        coverUrl: null,
        backCoverUrl: "https://example.com/new-back.jpg",
      },
    });

    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

    expect(requestedUrls.some((url) => url.includes("inc=recordings"))).toBe(false);
  });
});