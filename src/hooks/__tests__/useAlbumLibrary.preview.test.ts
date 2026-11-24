/**
 * DJVinyl Step 11A — artwork preview/apply regression tests.
 *
 * Save to: src/hooks/__tests__/useAlbumLibrary.preview.test.ts
 *
 * These tests target the previewAlbumArtwork() and applyArtworkPreview()
 * functions added in Step 11A. They intentionally live in a separate file
 * so your existing useAlbumLibrary.test.ts is left unchanged.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAlbumLibrary } from "@/src/hooks/useAlbumLibrary";
import {
  deleteAlbum,
  listAlbums,
  updateAlbum,
} from "@/src/services/albumRepository";
import {
  fetchAlbumArtwork,
  fetchAlbumMetadata,
} from "@/src/services/musicMetadata";
import type { Album } from "@/src/types/album";

type LibraryAlbum = Album & { $id: string };
type AppwriteDocuments = Awaited<ReturnType<typeof listAlbums>>;
type HookResult = ReturnType<typeof useAlbumLibrary>;
type SearchResult = Awaited<ReturnType<HookResult["previewAlbumArtwork"]>>;
type ReadyPreview = Extract<SearchResult, { status: "ready" }>["preview"];

const CURRENT_FRONT = "https://example.com/old-front.jpg";
const CURRENT_BACK = "https://example.com/old-back.jpg";
const NEW_FRONT = "https://example.com/new-front.jpg";
const NEW_BACK = "https://example.com/new-back.jpg";
const ALT_FRONT = "https://example.com/alternate-front.jpg";
const ALT_BACK = "https://example.com/alternate-back.jpg";

const albumOne: LibraryAlbum = {
  $id: "album-1",
  title: "Album One",
  artist: "Artist One",
  url: CURRENT_FRONT,
  backCoverUrl: CURRENT_BACK,
  sides: 2,
  genres: ["rock"],
  trackList: ["Track One - 3:15"],
};

const albumTwo: LibraryAlbum = {
  ...albumOne,
  $id: "album-2",
  title: "Album Two",
  artist: "Artist Two",
  url: "https://example.com/other-front.jpg",
  backCoverUrl: "https://example.com/other-back.jpg",
};

const newPair = {
  candidate: {
    kind: "pair" as const,
    release: {
      id: "vinyl-release-123",
      title: "Album One",
      "artist-credit": [{ name: "Artist One" }],
      media: [{ format: '12" Vinyl' }],
    },
  },
  artwork: {
    coverUrl: NEW_FRONT,
    backCoverUrl: NEW_BACK,
  },
};

const alternatePair = {
  candidate: {
    kind: "pair" as const,
    release: {
      id: "vinyl-release-456",
      title: "Album One",
      "artist-credit": [{ name: "Artist One" }],
      media: [{ format: '12" Vinyl' }],
    },
  },
  artwork: {
    coverUrl: ALT_FRONT,
    backCoverUrl: ALT_BACK,
  },
};

function asDocument(albums: LibraryAlbum[]): AppwriteDocuments {
  return albums as unknown as AppwriteDocuments;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Calls the real hook's discovery function, but throws if the fixture does
 * not produce a preview. This keeps the assertions in individual tests clear.
 */
async function getReadyPreview(
  hook: { current: HookResult },
  albumId = "album-1"
): Promise<ReadyPreview> {
  let searchResult: SearchResult | undefined;

  await act(async () => {
    searchResult = await hook.current.previewAlbumArtwork(albumId);
  });

  if (!searchResult || searchResult.status !== "ready") {
    throw new Error(
      `Expected an artwork preview; received ${JSON.stringify(searchResult)}`
    );
  }

  return searchResult.preview;
}

jest.mock("@/src/services/albumRepository", () => ({
  listAlbums: jest.fn(),
  createAlbum: jest.fn(),
  updateAlbum: jest.fn(),
  deleteAlbum: jest.fn(),
}));

jest.mock("@/src/services/musicMetadata", () => ({
  fetchAlbumMetadata: jest.fn(),
  fetchAlbumArtwork: jest.fn(),
}));

describe("useAlbumLibrary — artwork preview (Step 11A)", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne]));
    jest.mocked(updateAlbum).mockResolvedValue(undefined);
    jest.mocked(deleteAlbum).mockResolvedValue(undefined);

    jest.mocked(fetchAlbumMetadata).mockResolvedValue({
      coverUrl: null,
      backCoverUrl: null,
      trackList: [],
    });

    jest.mocked(fetchAlbumArtwork).mockResolvedValue(newPair);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function mountLibrary() {
    const hook = await renderHook(() => useAlbumLibrary("library-A"));
    await waitFor(() => {
      expect(hook.result.current.loadedLibraryId).toBe("library-A");
      expect(hook.result.current.albums).toHaveLength(1);
    });
    return hook;
  }

  test("1. finds a replacement pair and returns the correct preview details", async () => {
    const { result } = await mountLibrary();

    const preview = await getReadyPreview(result);

    expect(fetchAlbumArtwork).toHaveBeenCalledWith(albumOne, true);
    expect(preview).toEqual({
      libraryId: "library-A",
      albumId: "album-1",
      releaseId: "vinyl-release-123",
      releaseTitle: "Album One",
      releaseFormat: '12" Vinyl',
      current: {
        frontUrl: CURRENT_FRONT,
        backUrl: CURRENT_BACK,
      },
      proposed: {
        frontUrl: NEW_FRONT,
        backUrl: NEW_BACK,
      },
      changes: {
        url: NEW_FRONT,
        backCoverUrl: NEW_BACK,
      },
    });
  });

  test("2. only previews artwork and does not update Appwrite or local albums", async () => {
    const { result } = await mountLibrary();

    await getReadyPreview(result);

    expect(fetchAlbumArtwork).toHaveBeenCalledTimes(1);
    expect(updateAlbum).not.toHaveBeenCalled();
    expect(result.current.albums[0]).toEqual(albumOne);
    expect(result.current.albums[0].trackList).toEqual(["Track One - 3:15"]);
  });

  test("3. saves the preview only after approval without fetching again", async () => {
    const { result } = await mountLibrary();
    const preview = await getReadyPreview(result);

    let status = "";
    await act(async () => {
      status = await result.current.applyArtworkPreview(preview);
    });

    expect(status).toBe("updated");
    expect(updateAlbum).toHaveBeenCalledTimes(1);
    expect(updateAlbum).toHaveBeenCalledWith("library-A", "album-1", {
      url: NEW_FRONT,
      backCoverUrl: NEW_BACK,
    });
    expect(fetchAlbumArtwork).toHaveBeenCalledTimes(1);
    expect(result.current.albums[0]).toEqual({
      ...albumOne,
      url: NEW_FRONT,
      backCoverUrl: NEW_BACK,
    });
  });

  test("4. rejects a preview from another library after switching owners", async () => {
    jest.mocked(listAlbums).mockImplementation(async (libraryId) => {
      if (libraryId === "library-A") return asDocument([albumOne]);
      if (libraryId === "library-B") return asDocument([albumTwo]);
      return asDocument([]);
    });

    const { result, rerender } = await renderHook(
      ({ owner }: { owner: string }) => useAlbumLibrary(owner),
      { initialProps: { owner: "library-A" } }
    );

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-A");
    });

    const preview = await getReadyPreview(result);

    await act(async () => {
      rerender({ owner: "library-B" });
    });

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-B");
      expect(result.current.albums[0].$id).toBe("album-2");
    });

    let status = "";
    await act(async () => {
      status = await result.current.applyArtworkPreview(preview);
    });

    expect(status).toBe("skipped");
    expect(updateAlbum).not.toHaveBeenCalled();
    expect(result.current.albums).toEqual([albumTwo]);
  });

  test("5. rejects a stale preview if artwork changed after discovery", async () => {
    jest.mocked(fetchAlbumArtwork)
      .mockResolvedValueOnce(newPair)
      .mockResolvedValueOnce(alternatePair);

    const { result } = await mountLibrary();

    // Both previews were created against the original artwork.
    const stalePreview = await getReadyPreview(result);
    const acceptedPreview = await getReadyPreview(result);

    let acceptedStatus = "";
    await act(async () => {
      acceptedStatus = await result.current.applyArtworkPreview(acceptedPreview);
    });
    expect(acceptedStatus).toBe("updated");

    let staleStatus = "";
    await act(async () => {
      staleStatus = await result.current.applyArtworkPreview(stalePreview);
    });

    expect(staleStatus).toBe("skipped");
    expect(updateAlbum).toHaveBeenCalledTimes(1);
    expect(updateAlbum).toHaveBeenCalledWith("library-A", "album-1", {
      url: ALT_FRONT,
      backCoverUrl: ALT_BACK,
    });
    expect(result.current.albums[0].url).toBe(ALT_FRONT);
    expect(result.current.albums[0].backCoverUrl).toBe(ALT_BACK);
  });

  test("6. reports unchanged when MusicBrainz finds no suitable artwork", async () => {
    jest.mocked(fetchAlbumArtwork).mockResolvedValue({
      candidate: null,
      artwork: { coverUrl: null, backCoverUrl: null },
    });

    const { result } = await mountLibrary();

    let searchResult: SearchResult | undefined;
    await act(async () => {
      searchResult = await result.current.previewAlbumArtwork("album-1");
    });

    expect(searchResult).toEqual({ status: "unchanged" });
    expect(fetchAlbumArtwork).toHaveBeenCalledWith(albumOne, true);
    expect(updateAlbum).not.toHaveBeenCalled();
    expect(result.current.albums[0]).toEqual(albumOne);
  });

  test("7. returns busy for concurrent searches of the same album", async () => {
    type ArtworkLookup = Awaited<ReturnType<typeof fetchAlbumArtwork>>;
    const deferred = createDeferred<ArtworkLookup>();

    jest.mocked(fetchAlbumArtwork).mockReturnValueOnce(deferred.promise);

    const { result } = await mountLibrary();

    // Start the first request and keep MusicBrainz pending.
    const firstSearch = result.current.previewAlbumArtwork("album-1");
    expect(fetchAlbumArtwork).toHaveBeenCalledTimes(1);

    // The same album must not start a second concurrent request.
    let concurrentResult: SearchResult | undefined;
    await act(async () => {
      concurrentResult = await result.current.previewAlbumArtwork("album-1");
    });

    expect(concurrentResult).toEqual({ status: "busy" });
    expect(fetchAlbumArtwork).toHaveBeenCalledTimes(1);

    // Finish the initial lookup; concurrency protection must be released.
    let firstResult: SearchResult | undefined;
    await act(async () => {
      deferred.resolve(newPair);
      firstResult = await firstSearch;
    });

    expect(firstResult?.status).toBe("ready");
    expect(updateAlbum).not.toHaveBeenCalled();

    let nextResult: SearchResult | undefined;
    await act(async () => {
      nextResult = await result.current.previewAlbumArtwork("album-1");
    });

    expect(nextResult?.status).toBe("ready");
    expect(fetchAlbumArtwork).toHaveBeenCalledTimes(2);
  });
});
