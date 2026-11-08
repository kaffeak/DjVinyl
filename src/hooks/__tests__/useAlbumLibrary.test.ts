import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import { useAlbumLibrary} from "@/src/hooks/useAlbumLibrary";
import {createAlbum, deleteAlbum, listAlbums, updateAlbum} from "@/src/services/albumRepository";
import {Album} from "@/src/types/album";
import {fetchAlbumMetadata} from "@/src/services/musicMetadata";

type LibraryAlbum = Album & { $id: string };

type AppwriteDocuments = Awaited<ReturnType<typeof listAlbums>>;

function asDocument(albums: LibraryAlbum[]): AppwriteDocuments {
  return albums as unknown as AppwriteDocuments;
};

const albumOne: LibraryAlbum = {
  $id: "album-1",
  title: "Album One",
  artist: "Artist One",
  url: "https://example.com/cover1.jpg",
  sides: 2,
  genres: ["rock"],
  trackList: ["Track One - 3:15"],
};

const albumTwo: LibraryAlbum = {
  $id: "album-2",
  title: "Album Two",
  artist: "Artist Two",
  url: "https://example.com/cover2.jpg",
  sides: 2,
  genres: ["rock", "jazz"],
  trackList: ["Track One - 4:30"],
};

jest.mock("@/src/services/albumRepository", () => ({
  listAlbums: jest.fn(),
  createAlbum: jest.fn(),
  updateAlbum: jest.fn(),
  deleteAlbum: jest.fn(),
}));

jest.mock("@/src/services/musicMetadata", () => ({
  fetchAlbumMetadata: jest.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return {promise, resolve};
};

describe("useAlbumLibrary", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    jest.mocked(listAlbums).mockResolvedValue(asDocument([]));

    jest.mocked(updateAlbum).mockResolvedValue(undefined);
    jest.mocked(deleteAlbum).mockResolvedValue(undefined);

    jest.mocked(fetchAlbumMetadata).mockResolvedValue({
      coverUrl: null,
      trackList: [],
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("should load albums from the selected library", async () => {
    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne, albumTwo]));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listAlbums).toHaveBeenCalledWith("library-A");

    expect(result.current.loadedLibraryId).toBe("library-A");

    expect(result.current.albums).toHaveLength(2);

    expect(result.current.albums.map((album) => album.$id)).toEqual(["album-1", "album-2"]);

    expect(result.current.allGenres).toEqual({
      rock: 2,
      jazz: 1,
    });

    expect(fetchAlbumMetadata).not.toHaveBeenCalled();
  });

  test("should handle an Appwrite loading failure", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    jest.mocked(listAlbums).mockRejectedValue(new Error("Appwrite unavailable"));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.loadError).toBe("Could not load the album library.");
    });

    expect(result.current.isLoading).toBe(false);

    expect(result.current.albums).toEqual([]);

    expect(result.current.allGenres).toEqual({});
  });

  test("should ignore outdated responses when switching libraries", async () => {
    const libraryARequest = createDeferred<AppwriteDocuments>();

    jest.mocked(listAlbums).mockImplementation((libraryId) => {
      if (libraryId === "library-A") {
        return libraryARequest.promise;
      }

      if (libraryId === "library-B") {
        return Promise.resolve(asDocument([albumTwo]));
      }

      return Promise.resolve(asDocument([]));
    });

    const { result, rerender} = await renderHook(({owner}: {owner: string}) => useAlbumLibrary(owner), { initialProps: {owner: "library-A"},});

    await rerender({owner: "library-B"});

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-B");
    });

    expect(result.current.albums.map((album) => album.$id)).toEqual(["album-2"]);

    await act(async () => {
      libraryARequest.resolve(asDocument([albumOne]));
    });

    expect(result.current.loadedLibraryId).toBe("library-B");

    expect(result.current.albums.map((album) => album.$id)).toEqual(["album-2"]);
  });

  test("should add a newly created album to the library", async () => {
    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne, albumTwo]));

    const newAlbumData = {
      title: "Album Three",
      artist: "Artist Three",
      sides: 2,
      genres: ["metal"],
    };

    const createdDocument = {
      ...newAlbumData,
      $id: "album-3",
      url: "https://example.com/cover3.jpg",
      trackList: ["Track Three - 3:00"],
    };

    jest.mocked(createAlbum).mockResolvedValue(createdDocument as unknown as Awaited<ReturnType<typeof createAlbum>>);

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    expect(result.current.albums).toHaveLength(2);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;

    await act(async () => {
      success = await result.current.addAlbum(newAlbumData);
    });

    expect(success).toBe(true);

    expect(result.current.albums).toHaveLength(3);

    expect(createAlbum).toHaveBeenCalledWith(
      "library-A",
      {
        title: "Album Three",
        artist: "Artist Three",
        sides: 2,
        genres: ["metal"],
      }
    );

    expect(result.current.albums).toContainEqual(expect.objectContaining({
      title: "Album Three",
      artist: "Artist Three",
      sides: 2,
      genres: ["metal"],
    }))

    expect(result.current.allGenres).toEqual({
      rock: 2,
      jazz: 1,
      metal: 1,
    });
  });
});