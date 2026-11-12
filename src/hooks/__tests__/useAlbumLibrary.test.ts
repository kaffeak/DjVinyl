import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import { useAlbumLibrary} from "@/src/hooks/useAlbumLibrary";
import {createAlbum, deleteAlbum, listAlbums, updateAlbum} from "@/src/services/albumRepository";
import {Album} from "@/src/types/album";
import {fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {list} from "postcss";
import {classPrivateMethod} from "@babel/types";

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
  backCoverUrl: "https://example.com/backcover1.jpg",
  sides: 2,
  genres: ["rock"],
  trackList: ["Track One - 3:15"],
};

const albumTwo: LibraryAlbum = {
  $id: "album-2",
  title: "Album Two",
  artist: "Artist Two",
  url: "https://example.com/cover2.jpg",
  backCoverUrl: "https://example.com/backcover2.jpg",
  sides: 2,
  genres: ["rock", "jazz"],
  trackList: ["Track One - 4:30"],
};

const incompleteAlbum: LibraryAlbum = {
  ...albumOne,
  $id: "album-missing",
  title: "Missing Album",
  artist: "Missing Artist",
  url: "",
  backCoverUrl: "",
  trackList: [],
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
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {promise, resolve, reject};
}

describe("useAlbumLibrary", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    jest.mocked(listAlbums).mockResolvedValue(asDocument([]));

    jest.mocked(updateAlbum).mockResolvedValue(undefined);
    jest.mocked(deleteAlbum).mockResolvedValue(undefined);

    jest.mocked(fetchAlbumMetadata).mockResolvedValue({
      coverUrl: null,
      backCoverUrl: null,
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
      backCoverUrl: "https://example.com/backcover3.jpg",
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

  test("should update album genres", async () => {
    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne, albumTwo]));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateGenres("Album One", "Artist One", ["jazz", "funk"]);
    });

    expect(updateAlbum).toHaveBeenCalledWith("library-A", "album-1", {genres: ["jazz", "funk"]});

    const updatedAlbum = result.current.albums.find((album) => album.$id === "album-1");

    expect(updatedAlbum?.genres).toEqual(["jazz", "funk"]);

    expect(result.current.albums.find((album) => album.$id === "album-2")?.genres).toEqual(["rock", "jazz"]);

    expect(result.current.allGenres).toEqual({
      rock: 1,
      jazz: 2,
      funk: 1,
    });
  });

  test("should delete an album and update genre counts", async () => {
    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne, albumTwo]));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.albums).toHaveLength(2);

    await act(async () => {
      await result.current.removeAlbum(albumOne);
    });

    expect(result.current.albums).toHaveLength(1);

    expect(result.current.albums.map((album) => album.$id)).toEqual(["album-2"]);

    expect(result.current.allGenres).toEqual({
      rock: 1,
      jazz: 1,
    });
  });

  test("should preserve a new album when metadata fetching fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

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
      url: "",
      backCoverUrl: "",
      trackList: [],
    };

    jest.mocked(createAlbum).mockResolvedValue(createdDocument as unknown as Awaited<ReturnType<typeof createAlbum>>);

    jest.mocked(fetchAlbumMetadata).mockRejectedValue(new Error("MusicBrainz unavailable"));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;

    await act(async () => {
      success = await result.current.addAlbum(newAlbumData);
    });

    expect(success).toBe(true);

    await waitFor(() => {
      expect(fetchAlbumMetadata).toHaveBeenCalledWith("Album Three", "Artist Three");
    });

    expect(result.current.albums).toHaveLength(3);

    expect(result.current.albums).toContainEqual(expect.objectContaining({
      $id: "album-3",
      title: "Album Three",
      url: "",
      trackList: [],
    }));

    expect(updateAlbum).not.toHaveBeenCalled();

    expect(result.current.allGenres).toEqual({
      rock: 2,
      jazz: 1,
      metal: 1,
    });
  });

  test("should preserve an album when deletion fails", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});

    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumOne, albumTwo]));

    jest.mocked(deleteAlbum).mockRejectedValue(new Error("Appwrite unavailable"));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.removeAlbum(albumOne);
    });

    expect(deleteAlbum).toHaveBeenCalledWith("library-A", "album-1");

    expect(result.current.albums).toHaveLength(2);

    expect(result.current.albums.map((album) => album.$id)).toEqual(["album-1", "album-2"]);

    expect(result.current.allGenres).toEqual({
      rock: 2,
      jazz: 1,
    });
  });

  test("should only fetch metadata for incomplete albums", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.mocked(listAlbums).mockResolvedValue(asDocument([albumTwo, incompleteAlbum]));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-A");
    });

    expect(result.current.albums).toHaveLength(2);

    expect(fetchAlbumMetadata).toHaveBeenCalledTimes(1);

    expect(fetchAlbumMetadata).toHaveBeenCalledWith("Missing Album", "Missing Artist");

    expect(updateAlbum).not.toHaveBeenCalled();
  });
  
  test("should respect metadata cooldown and maximum attempts", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});

    const actualNow = Date.now.bind(Date);
    let timeOffset = 0;
    
    jest.spyOn(Date, "now").mockImplementation(() => actualNow() + timeOffset);
    
    jest.mocked(listAlbums).mockImplementation(
      async (libraryId) =>
        asDocument(libraryId === "library-A" ? [incompleteAlbum] : [])
    );
    
    type MetadataResult = Awaited<ReturnType<typeof fetchAlbumMetadata>>;
    
    const firstAttempt = createDeferred<MetadataResult>();
    const secondAttempt = createDeferred<MetadataResult>();
    
    jest.mocked(fetchAlbumMetadata).mockReturnValueOnce(firstAttempt.promise).mockReturnValueOnce(secondAttempt.promise);
    
    const {result, rerender} = await renderHook(({owner}: {owner: string}) => useAlbumLibrary(owner), {initialProps: {owner: "library-A"},});
    
    const reloadLibraryA = async () => {
      await rerender({owner: "library-B"});
      
      await waitFor(() => {
        expect(result.current.loadedLibraryId).toBe("library-B");
      });
      
      await rerender({owner: "library-A"});
      
      await waitFor(() => {
        expect(result.current.loadedLibraryId).toBe("library-A");
      });
    };
    
    await waitFor(() => {
      expect(fetchAlbumMetadata).toHaveBeenCalledTimes(1);
    });
    
    await act(async () => {
      firstAttempt.reject(
        new Error("MusicBrainz unavailable")
      );
      await firstAttempt.promise.catch(() => {});
    });
    
    await reloadLibraryA();
    
    expect(fetchAlbumMetadata).toHaveBeenCalledTimes(1);
    
    timeOffset += 5 * 60 * 1000 + 1000;
    
    await reloadLibraryA();
    
    await waitFor(() => {
      expect(fetchAlbumMetadata).toHaveBeenCalledTimes(2);
    });
    
    await act(async () => {
      secondAttempt.reject(
        new Error("MusicBrainz unavailable")
      );
      await secondAttempt.promise.catch(() => {});
    });

    timeOffset += 5 * 60 * 1000 + 1000;
    
    await reloadLibraryA();
    
    expect(fetchAlbumMetadata).toHaveBeenCalledTimes(2);
    
    expect(result.current.albums).toHaveLength(1);
    expect(result.current.albums[0].$id).toBe("album-missing");
    
    expect(updateAlbum).not.toHaveBeenCalled();
  });

  test("should limit automatic metadata lookups per library load", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const incompletAlbums = Array.from(
      { length: 5},
      (_, index): LibraryAlbum => ({
        ...incompleteAlbum,
        $id: `missing-${index}`,
        title: `Missing Album${index}`,
        artist: `Missing Artist${index}`,
      })
    );

    jest.mocked(listAlbums).mockResolvedValue(asDocument(incompletAlbums));

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.albums).toHaveLength(5);

    expect(fetchAlbumMetadata).toHaveBeenCalledTimes(3);

    for (let i = 0; i<3; i++) {
      expect(fetchAlbumMetadata).toHaveBeenNthCalledWith(i+1, `Missing Album${i}`, `Missing Artist${i}`);
    }

    expect(fetchAlbumMetadata).not.toHaveBeenCalledWith("Missing Album3", "Missing Artist3");
    expect(fetchAlbumMetadata).not.toHaveBeenCalledWith("Missing Album4", "Missing Artist4");
  });

  test("should save back-cover artwork when metadata is fetched", async () => {

    jest.mocked(listAlbums).mockResolvedValue(asDocument([incompleteAlbum]));

    jest.mocked(fetchAlbumMetadata).mockResolvedValue({
      coverUrl: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
      trackList: ["Track One - 3:15"],
    });

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-A");
    });

    expect(result.current.albums).toHaveLength(1);

    await waitFor(() => {
      expect(fetchAlbumMetadata).toHaveBeenCalledWith("Missing Album", "Missing Artist");
    });

    await waitFor(() => {
      expect(updateAlbum).toHaveBeenCalledWith("library-A", "album-missing", {
        url: "https://example.com/front.jpg",
        backCoverUrl: "https://example.com/back.jpg",
        trackList: ["Track One - 3:15"],
      });
    });

    await waitFor(() => {
      expect(result.current.albums[0]).toEqual(
        expect.objectContaining({
          $id: "album-missing",
          url: "https://example.com/front.jpg",
          backCoverUrl: "https://example.com/back.jpg",
          trackList: ["Track One - 3:15"],
        })
      );
    });
  });

  test("should preserve existing front cover when fetching missing metadata", async () => {
    const pratiallyCompleteAlbum: LibraryAlbum = {
      ...incompleteAlbum,
      url: "https://example.com/existing-front.jpg",
      backCoverUrl: "",
      trackList: [],
    };

    jest.mocked(listAlbums).mockResolvedValue(asDocument([pratiallyCompleteAlbum]));

    jest.mocked(fetchAlbumMetadata).mockResolvedValue({
      coverUrl: "https://example.com/new-front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
      trackList: ["Track One - 3:15"],
    });

    const {result} = await renderHook(() => useAlbumLibrary("library-A"));

    await waitFor(() => {
      expect(result.current.loadedLibraryId).toBe("library-A");
    });

    await waitFor(() => {
      expect(fetchAlbumMetadata).toHaveBeenCalledWith("Missing Album", "Missing Artist");
    });

    await waitFor(() => {
      expect(updateAlbum).toHaveBeenCalledWith("library-A", "album-missing", {
        backCoverUrl: "https://example.com/back.jpg",
        trackList: ["Track One - 3:15"],
      });
    });

    await waitFor(() => {
      expect(result.current.albums[0]).toEqual(
        expect.objectContaining({
          $id: "album-missing",
          url: "https://example.com/existing-front.jpg",
          backCoverUrl: "https://example.com/back.jpg",
          trackList: ["Track One - 3:15"],
        })
      );
    });

    expect(jest.mocked(updateAlbum).mock.calls[0][2]).not.toHaveProperty("url");
  });
});