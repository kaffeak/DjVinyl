import {act, renderHook} from "@testing-library/react-native"
import {Album} from "@/src/types/album";
import {useAlbumDeck} from "@/src/hooks/useAlbumDeck";
import {Props} from "expo-system-ui/plugin/build/withAndroidUserInterfaceStyle";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock" )
);

type LibraryAlbum = Album & { $id: string};

const albums: LibraryAlbum[] = [
  {
    $id: "album-1",
    title: "Album One",
    artist: "Artist One",
    url: "",
    sides: 2,
    genres: ["rock"],
    trackList: [],
  },
  {
    $id: "album-2",
    title: "Album Two",
    artist: "Artist Two",
    url: "",
    sides: 1,
    genres: ["jazz"],
    trackList: [],
  },
  {
    $id: "album-3",
    title: "Album Three",
    artist: "Artist Three",
    url: "",
    sides: 2,
    genres: ["rock"],
    trackList: [],
  },
];

const defaultProps = {
  albums,
  owner: "library-1",
  loadedLibraryId: "library-1",
};

describe("useAlbumDeck", () => {
  test("should initialize one card per album", async () => {
    const {result} = await renderHook(() => useAlbumDeck(defaultProps));

    expect(result.current.cards).toHaveLength(3);

    const albumIds = result.current.cards.map((card) => card.album.$id).sort();

    expect(albumIds).toEqual([
      "album-1",
      "album-2",
      "album-3",
    ]);
  });

  test("should remove the first card when advancing", async () => {
    const {result} = await renderHook(() => useAlbumDeck(defaultProps));

    const originalEntryIds = result.current.cards.map((card) => card.entryId);

    await act(async () => {
      result.current.nextCard();
    });

    const remainingEntryIds = result.current.cards.map((card) => card.entryId);

    expect(remainingEntryIds).toEqual(originalEntryIds.slice(1));

    expect(result.current.cards).toHaveLength(2);
  });

  test("should preserve deck order when album artwork changes", async () => {
    const {result, rerender} = await renderHook((props: typeof defaultProps) => useAlbumDeck(props),
      {
        initialProps: defaultProps,
      });

    const originalEntryIds = result.current.cards.map((card) => card.entryId);

    const updatedAlbums = albums.map((album) => album.$id === "album-2" ? { ...album, url: "https://example.com/new-cover.jpg",} : album);

    await rerender({
      ...defaultProps,
      albums: updatedAlbums,
    });

    const updatedEntryIds = result.current.cards.map((card) => card.entryId);

    expect(updatedEntryIds).toEqual(originalEntryIds);

    const updatedCard = result.current.cards.find((card) => card.album.$id === "album-2");

    expect(updatedCard?.album.url).toBe("https://example.com/new-cover.jpg");
  });

  test("should create one card for each record side", async () => {
    const {result} = await renderHook(() => useAlbumDeck(defaultProps));

    await act(async () => {
      result.current.setShuffleMode("sides");
    });

    expect(result.current.cards).toHaveLength(5);

    const sides = result.current.cards.map((card) => `${card.album.$id}:${card.album.sideLetter}`).sort();

    expect(sides).toEqual([
      "album-1:A",
      "album-1:B",
      "album-2:A",
      "album-3:A",
      "album-3:B",
    ]);
  });

  test("should only preserve records with the correct genre", async () => {
    const extendedAlbums: LibraryAlbum[] = [
      ...defaultProps.albums,
      {
        $id: "album-4",
        title: "Album Four",
        artist: "Artist Four",
        url: "",
        sides: 2,
        genres: ["pop", "jazz"],
        trackList: [],
      },
    ];

    const extendedProps = {
      ...defaultProps,
      albums: extendedAlbums,
    }
    const {result} = await renderHook((props: typeof extendedProps) => useAlbumDeck(props), {
      initialProps: extendedProps,
    });

    await act(async () => {
      result.current.toggleGenre("jazz");
    });

    expect(result.current.cards).toHaveLength(2);

    const remainingAlbumIds = result.current.cards.map((card) => card.album.$id).sort();

    expect(remainingAlbumIds).toEqual([
      "album-2",
      "album-4",
    ]);

    await act(async () => {
      result.current.toggleGenre("pop");
    });

    expect(result.current.cards).toHaveLength(2);

    const remainingAlbumIdsStepTwo = result.current.cards.map((card) => card.album.$id).sort();

    expect(remainingAlbumIdsStepTwo).toEqual([
      "album-2",
      "album-4",
    ]);

    await act(async () => {
      result.current.toggleGenre("jazz");
      result.current.toggleGenre("rock");
    });

    expect(result.current.cards).toHaveLength(3);

    const remainingAlbumIdsStepThree = result.current.cards.map((card) => card.album.$id).sort();

    expect(remainingAlbumIdsStepThree).toEqual([
      "album-1",
      "album-3",
      "album-4",
    ]);
  });
});

