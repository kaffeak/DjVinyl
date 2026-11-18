import {fetchAlbumArtwork, fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {selectBestRelease} from "@/src/utils/releaseMatching";
import {buildArtworkChanges} from "@/src/utils/artworkChanges";

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

      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [
                { name: "Iron Maiden" },
              ],
              score: 100,
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

      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [
                { name: "Iron Maiden" },
              ],
              score: 100,
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

  test("should reject an unrelated release group even with a higher search score", async () => {
    const album = {
      title: "The Correct Album",
      artist: "Test Artist",
      url: "https://example.com/old-front.jpg",
      backCoverUrl: "",
    };

    const selectedRelease = {
      id: "correct-vinyl",
      title: "The Correct Album",
      "artist-credit": [{ name: "Test Artist" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "wrong-group",
              title: "Another Album",
              "artist-credit": [{ name: "Test Artist" }],
              score: 100,
            },
            {
              id: "correct-group",
              title: "The Correct Album",
              "artist-credit": [{ name: "Test Artist" }],
              score: 85,
            },
          ],
        });
      }

      if (url.includes("release-group=correct-group")) {
        return mockResponse({
          releases: [selectedRelease],
        });
      }

      if (
        url.includes(
          "coverartarchive.org/release/correct-vinyl/"
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

    const requestedUrls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    expect(
      requestedUrls.some((url) =>
        url.includes("release-group=wrong-group")
      )
    ).toBe(false);

    expect(
      requestedUrls.some((url) =>
        url.includes("release-group=correct-group")
      )
    ).toBe(true);
  });

  test("should try another vinyl release when the first has no actual back cover", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/old-front.jpg",
      backCoverUrl: "",
    };

    const makeRelease = (id: string) => ({
      id,
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    });

    const firstRelease = makeRelease("vinyl-a");
    const secondRelease = makeRelease("vinyl-b");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              score: 100,
            },
          ],
        });
      }

      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [firstRelease, secondRelease],
        });
      }

      if (url.includes("coverartarchive.org/release/vinyl-a/")) {
        // Advertised as a pair, but only the front exists.
        return mockResponse({
          images: [
            {
              front: true,
              thumbnails: {
                "500": "https://example.com/a-front.jpg",
              },
            },
          ],
        });
      }

      if (url.includes("coverartarchive.org/release/vinyl-b/")) {
        return mockResponse({
          images: [
            {
              front: true,
              thumbnails: {
                "500": "https://example.com/b-front.jpg",
              },
            },
            {
              back: true,
              thumbnails: {
                "500": "https://example.com/b-back.jpg",
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
        release: secondRelease,
      },
      artwork: {
        coverUrl: "https://example.com/b-front.jpg",
        backCoverUrl: "https://example.com/b-back.jpg",
      },
    });

    await jest.runAllTimersAsync();
    await assertion;

    const urls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    expect(
      urls.some((url) =>
        url.includes("coverartarchive.org/release/vinyl-a/")
      )
    ).toBe(true);

    expect(
      urls.some((url) =>
        url.includes("coverartarchive.org/release/vinyl-b/")
      )
    ).toBe(true);

    // Artwork lookup must not fetch track lists.
    expect(
      urls.some((url) => url.includes("inc=recordings"))
    ).toBe(false);
  });

  test("should preserve existing front when a vinyl pair only returns a back cover", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/existing-front.jpg",
      backCoverUrl: "",
    };

    const vinylRelease = {
      id: "vinyl-release",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    const cdRelease = {
      id: "cd-release",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: "CD" }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
            },
          ],
        });
      }

      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [vinylRelease, cdRelease],
        });
      }

      if (
        url.includes("coverartarchive.org/release/vinyl-release/")
      ) {
        return mockResponse({
          images: [
            {
              back: true,
              thumbnails: {
                "500": "https://example.com/vinyl-back.jpg",
              },
            },
          ],
        });
      }

      if (
        url.includes("coverartarchive.org/release/cd-release/")
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              thumbnails: {
                "500": "https://example.com/cd-front.jpg",
              },
            },
            {
              back: true,
              thumbnails: {
                "500": "https://example.com/cd-back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const resultPromise = fetchAlbumArtwork(album);

    await jest.runAllTimersAsync();

    const result = await resultPromise;

    // Vinyl back-only is preferred over a complete CD pair
    // when the album already has a front cover.
    expect(result.candidate?.kind).toBe("back-only");
    expect(result.candidate?.release.id).toBe("vinyl-release");

    expect(buildArtworkChanges(
      album,
      result.candidate,
      result.artwork
    )).toEqual({
      backCoverUrl: "https://example.com/vinyl-back.jpg",
    });

    // The CD should not need to be fetched.
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes(
          "coverartarchive.org/release/cd-release/"
        )
      )
    ).toBe(false);
  });

  test("should prefer a complete CD pair over incomplete vinyl artwork when no front exists", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "",
      backCoverUrl: "",
    };

    const vinylRelease = {
      id: "vinyl-release",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    const cdRelease = {
      id: "cd-release",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: "CD" }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      // 1. MusicBrainz release-group search.
      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [{ name: "Iron Maiden" }],
              score: 100,
            },
          ],
        });
      }

      // 2. Browse releases in the matching group.
      if (url.includes("release-group=group-123")) {
        return mockResponse({
          releases: [vinylRelease, cdRelease],
        });
      }

      // 3. Vinyl advertises both covers,
      // but Cover Art Archive only returns the front.
      if (
        url.includes("coverartarchive.org/release/vinyl-release/")
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              back: false,
              thumbnails: {
                "500": "https://example.com/vinyl-front.jpg",
              },
            },
          ],
        });
      }

      // 4. CD actually provides both covers.
      if (
        url.includes("coverartarchive.org/release/cd-release/")
      ) {
        return mockResponse({
          images: [
            {
              front: true,
              back: false,
              thumbnails: {
                "500": "https://example.com/cd-front.jpg",
              },
            },
            {
              front: false,
              back: true,
              thumbnails: {
                "500": "https://example.com/cd-back.jpg",
              },
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    // Start the artwork lookup.
    const resultPromise = fetchAlbumArtwork(album);

    await jest.runAllTimersAsync();

    const result = await resultPromise;

    // The complete CD pair should be preferred.
    expect(result.candidate?.kind).toBe("pair");
    expect(result.candidate?.release.id).toBe("cd-release");

    expect(result.artwork).toEqual({
      coverUrl: "https://example.com/cd-front.jpg",
      backCoverUrl: "https://example.com/cd-back.jpg",
    });

    // Verify that both releases were checked.
    const requestedUrls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    expect(
      requestedUrls.some((url) =>
        url.includes("coverartarchive.org/release/vinyl-release/")
      )
    ).toBe(true);

    expect(
      requestedUrls.some((url) =>
        url.includes("coverartarchive.org/release/cd-release/")
      )
    ).toBe(true);

    // Artwork refresh must never fetch track lists.
    expect(
      requestedUrls.some((url) => url.includes("inc=recordings"))
    ).toBe(false);
  });

  test("should find artwork through release search when release-group search has no match", async () => {
    const album = {
      title: "Test Album",
      artist: "Test Artist",
      url: "https://example.com/existing-front.jpg",
      backCoverUrl: "",
    };

    const matchingRelease = {
      id: "vinyl-release-123",
      title: "Test Album",
      "artist-credit": [{ name: "Test Artist" }],
      "release-group": {
        id: "alternative-group-123",
      },
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      // First search: no matching release groups.
      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "wrong-group",
              title: "Different Album",
              "artist-credit": [{ name: "Test Artist" }],
              score: 100,
            },
          ],
        });
      }

      // Second search: individual releases.
      if (
        url.includes("/ws/2/release/?") &&
        url.includes("query=")
      ) {
        return mockResponse({
          releases: [
            // Unrelated result with a higher score.
            {
              id: "wrong-release",
              title: "Different Album",
              "artist-credit": [{ name: "Test Artist" }],
              "release-group": {
                id: "wrong-group",
              },
              score: 100,
            },
            {
              ...matchingRelease,
              score: 75,
            },
          ],
        });
      }

      // Browse the group discovered from the valid release.
      if (
        url.includes(
          "release-group=alternative-group-123"
        )
      ) {
        return mockResponse({
          releases: [matchingRelease],
        });
      }

      // Cover Art Archive.
      if (
        url.includes(
          "coverartarchive.org/release/vinyl-release-123/"
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

    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(result.candidate?.kind).toBe("pair");

    expect(result.candidate?.release.id).toBe(
      "vinyl-release-123"
    );

    expect(result.artwork).toEqual({
      coverUrl: "https://example.com/new-front.jpg",
      backCoverUrl: "https://example.com/new-back.jpg",
    });

    const requestedUrls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    // The fallback search must have been used.
    expect(
      requestedUrls.some((url) =>
        url.includes("/ws/2/release/?") &&
        url.includes("query=")
      )
    ).toBe(true);

    // Browse only the group referenced by the
    // correctly matched release.
    expect(
      requestedUrls.some((url) =>
        url.includes(
          "release-group=alternative-group-123"
        )
      )
    ).toBe(true);

    expect(
      requestedUrls.some((url) =>
        url.includes("release-group=wrong-group")
      )
    ).toBe(false);

    // Artwork refreshing must not request track lists.
    expect(
      requestedUrls.some((url) =>
        url.includes("inc=recordings")
      )
    ).toBe(false);
  });

  test("should discover artwork using a single title typo without accepting unrelated releases", async () => {
    const album = {
      title: "CARLIFORNIA GIRLS",
      artist: "Lil Peep",
      url: "https://example.com/existing-front.jpg",
      backCoverUrl: "",
    };

    const correctRelease = {
      id: "california-vinyl",
      title: "California Girls",
      "artist-credit": [{ name: "Lil Peep" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      const decodedUrl = decodeURIComponent(url);

      // Exact release-group search and fuzzy search.
      if (url.includes("/ws/2/release-group/?")) {
        if (decodedUrl.includes("~0.8")) {
          return mockResponse({
            "release-groups": [
              {
                id: "wrong-artist-group",
                title: "California Girls",
                "artist-credit": [
                  { name: "Another Artist" },
                ],
                score: 100,
              },
              {
                id: "wrong-title-group",
                title: "California Boys",
                "artist-credit": [
                  { name: "Lil Peep" },
                ],
                score: 95,
              },
              {
                id: "correct-group",
                title: "California Girls",
                "artist-credit": [
                  { name: "Lil Peep" },
                ],
                score: 80,
              },
            ],
          });
        }

        // No exact release-group match.
        return mockResponse({
          "release-groups": [],
        });
      }

      // Exact individual release search also fails.
      if (
        url.includes("/ws/2/release/?") &&
        url.includes("query=")
      ) {
        return mockResponse({
          releases: [],
        });
      }

      // Browse the correctly validated group.
      if (url.includes("release-group=correct-group")) {
        return mockResponse({
          releases: [correctRelease],
        });
      }

      // Fetch the matched vinyl artwork.
      if (
        url.includes(
          "coverartarchive.org/release/california-vinyl/"
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

    const resultPromise = fetchAlbumArtwork(album);

    const assertion = expect(resultPromise).resolves.toEqual({
      candidate: {
        kind: "pair",
        release: correctRelease,
      },
      artwork: {
        coverUrl: "https://example.com/front.jpg",
        backCoverUrl: "https://example.com/back.jpg",
      },
    });

    await jest.runAllTimersAsync();
    await assertion;

    const urls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    // Fuzzy discovery must have been attempted.
    expect(
      urls.some((url) =>
        decodeURIComponent(url).includes(
          "releasegroup:carlifornia~0.8"
        )
      )
    ).toBe(true);

    // No unrelated release group may be browsed.
    expect(
      urls.some((url) =>
        url.includes("release-group=wrong-artist-group")
      )
    ).toBe(false);

    expect(
      urls.some((url) =>
        url.includes("release-group=wrong-title-group")
      )
    ).toBe(false);

    // The correct release group must be browsed.
    expect(
      urls.some((url) =>
        url.includes("release-group=correct-group")
      )
    ).toBe(true);

    // Artwork discovery must not modify stored titles.
    expect(album.title).toBe("CARLIFORNIA GIRLS");

    // Artwork discovery must not fetch track lists.
    expect(
      urls.some((url) => url.includes("inc=recordings"))
    ).toBe(false);
  });

  test("should discover artwork on a later release-group page", async () => {
    const album = {
      title: "Killers",
      artist: "Iron Maiden",
      url: "https://example.com/old-front.jpg",
      backCoverUrl: "",
    };

    const vinylRelease = {
      id: "vinyl-last-page",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden" }],
      media: [{ format: '12" Vinyl' }],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
      },
    };

    // Track the offsets requested by our implementation.
    const requestedOffsets: number[] = [];

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      // 1. Find the correct release group.
      if (url.includes("/ws/2/release-group/?")) {
        return mockResponse({
          "release-groups": [
            {
              id: "group-123",
              title: "Killers",
              "artist-credit": [
                { name: "Iron Maiden" },
              ],
              score: 100,
            },
          ],
        });
      }

      // 2. Simulate paginated release-group browsing.
      if (
        url.includes("/ws/2/release/?") &&
        url.includes("release-group=group-123")
      ) {
        const params = new URL(url).searchParams;
        const offset = Number(
          params.get("offset") ?? "0"
        );

        requestedOffsets.push(offset);

        // First page returns TWO releases,
        // even though the requested limit is 100.
        if (offset === 0) {
          return mockResponse({
            "release-count": 3,
            "release-offset": 0,
            releases: [
              {
                id: "digital-release",
                title: "Killers",
                "artist-credit": [
                  { name: "Iron Maiden" },
                ],
                media: [{ format: "Digital Media" }],
                "cover-art-archive": {
                  artwork: true,
                  front: true,
                  back: false,
                },
              },
              {
                id: "cd-no-back",
                title: "Killers",
                "artist-credit": [
                  { name: "Iron Maiden" },
                ],
                media: [{ format: "CD" }],
                "cover-art-archive": {
                  artwork: true,
                  front: true,
                  back: false,
                },
              },
            ],
          });
        }

        // The third release is on the second page.
        if (offset === 2) {
          return mockResponse({
            "release-count": 3,
            "release-offset": 2,
            releases: [vinylRelease],
          });
        }

        throw new Error(`Unexpected offset: ${offset}`);
      }

      // 3. Artwork exists on the second-page release.
      if (
        url.includes(
          "coverartarchive.org/release/vinyl-last-page/"
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
        release: vinylRelease,
      },
      artwork: {
        coverUrl: "https://example.com/new-front.jpg",
        backCoverUrl: "https://example.com/new-back.jpg",
      },
    });

    await jest.runAllTimersAsync();
    await assertion;

    // Both pages must have been requested.
    expect(requestedOffsets).toEqual([0, 2]);

    // The second page must use offset=2, not offset=100.
    expect(requestedOffsets).not.toContain(100);

    // All three releases were retrieved before ranking.
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Artwork refresh must not fetch track lists.
    const requestedUrls = fetchMock.mock.calls.map(
      ([input]) => String(input)
    );

    expect(
      requestedUrls.some((url) =>
        url.includes("inc=recordings")
      )
    ).toBe(false);
  });
});