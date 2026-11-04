import {Album, DeckEntry, ShuffleMode} from "@/src/types/album";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {shuffleArray} from "@/src/utils/albums";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_QUEUE = "lastQueue";
const makeLegacyKey = (album: Album) => `${album.title.trim().toLowerCase()}|${album.artist.trim().toLowerCase()}`;

type AlbumSource = {
  albumId: string;
  sides: number;
  genres: string[];
};

type QueueEntry = {
  albumId: string;
  sideLetter?: string;
};

export type DeckCard = {
  entryId: string;
  album: Album;
};

type Props = {
  albums: (Album & { $id: string})[];
  owner: string;
  loadedLibraryId: string | null;
};

export function useAlbumDeck({
  albums,
  owner,
  loadedLibraryId,
}: Props) {
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [queueMode, setQueueMode] = useState(false);
  const [shuffleMode, setShuffleMode] = useState<ShuffleMode>("albums");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const nextEntryNumber = useRef(0);
  const lastConfig = useRef<string | null>(null);
  const queueLoadVersion = useRef(0);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;

  const isLibraryReady = owner !== "" && loadedLibraryId === owner;

  const createEntry = useCallback(
    (source: QueueEntry): DeckEntry => ({
      entryId: `entry-${nextEntryNumber.current++}`,
      albumId: source.albumId,
      sideLetter: source.sideLetter,
    }),
    []
  );

  const deckStructureKey = JSON.stringify(
    albums.map((album) => ({
      albumId: album.$id,
      sides: album.sides,
      genres: album.genres,
    }))
  );

  const candidates = useMemo<QueueEntry[]>(() => {
    const sources = JSON.parse(deckStructureKey) as AlbumSource[];

    const filtered = sources.filter((album) =>
      selectedGenres.length === 0 || album.genres.some((genre) => selectedGenres.includes(genre))
    );

    if (shuffleMode === "albums") {
      return filtered.map((album) => ({
        albumId: album.albumId,
      }));
    }

    return filtered.flatMap((album) =>
      Array.from({length: album.sides}, (_, index) => ({
        albumId: album.albumId,
        sideLetter: String.fromCharCode(65 + index),
      }))
    );
  }, [deckStructureKey, selectedGenres, shuffleMode]);

  const createShuffledDeck = useCallback((): DeckEntry[] => {
    return shuffleArray(candidates).map(createEntry);
  }, [candidates, createEntry]);

  const nextCard = useCallback(() => {
    setEntries((prev) => prev.length > 0 ? prev.slice(1) : prev);
  }, []);

  const configKey = JSON.stringify({
    owner,
    deckStructureKey,
    selectedGenres,
    shuffleMode,
  });

  useEffect(() => {
    if (!isLibraryReady) {
      lastConfig.current = null;
      setEntries([]);
      return;
    }

    if (queueMode) {
      lastConfig.current = null;
      return;
    }

    const configurationChanged = lastConfig.current !== configKey;
    const deckIsEmpty = entries.length === 0 && candidates.length > 0;

    if (configurationChanged || deckIsEmpty) {
      lastConfig.current = configKey;
      setEntries(createShuffledDeck());
    }
  }, [isLibraryReady, queueMode, configKey, entries.length, candidates.length, createShuffledDeck]);

  const queueAlbum = useCallback(
    (album: Album) => {
      if (!queueMode || !album.$id) return;

      setEntries((prev) => [
        ...prev,
        createEntry({
          albumId: album.$id!,
          sideLetter: album.sideLetter,
        }),
      ]);
    }, [queueMode, createEntry]);


  const toggleQueueMode = async (current: boolean) => {
    if (!isLibraryReady) return;

    const storageKey = LAST_QUEUE + owner;

    if (current) {
      queueLoadVersion.current++;

      const savedEntries: QueueEntry[] = entries.map(
        ({ albumId, sideLetter }) => ({
          albumId,
          sideLetter,
        })
      );

      setQueueMode(false);

      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(savedEntries)
        );
      } catch (error) {
        console.error("Failed to save queue:", error);
      }

      return;
    }

    const version = ++queueLoadVersion.current;

    setQueueMode(true);
    setEntries([]);

    try {
      const saved = await AsyncStorage.getItem(storageKey);

      if (
        queueLoadVersion.current !== version ||
        currentOwner.current !== owner
      ) {
        return;
      }

      const parsed: unknown = saved
        ? JSON.parse(saved)
        : [];

      if (!Array.isArray(parsed)) {
        throw new Error("Invalid saved queue");
      }

      const availableAlbums = new Map(
        albums.map((album) => [album.$id, album])
      );

      const restoredEntries = parsed.flatMap(
        (item: unknown): DeckEntry[] => {
          if (typeof item === "string") {
            const album = albums.find(
              (a) => makeLegacyKey(a) === item
            );

            return album
              ? [createEntry({ albumId: album.$id })]
              : [];
          }

          if (
            typeof item !== "object" ||
            item === null ||
            !("albumId" in item) ||
            typeof item.albumId !== "string"
          ) {
            return [];
          }

          if (!availableAlbums.has(item.albumId)) {
            return [];
          }

          const sideLetter =
            "sideLetter" in item &&
            typeof item.sideLetter === "string"
              ? item.sideLetter
              : undefined;

          return [
            createEntry({
              albumId: item.albumId,
              sideLetter,
            }),
          ];
        }
      );

      setEntries(restoredEntries);
    } catch (error) {
      console.error("Failed to load queue:", error);

      if (queueLoadVersion.current === version) {
        setEntries([]);
      }
    }
  };

  const clearQueue = useCallback(() => {
    setEntries([]);
  }, []);

  const cards = useMemo<DeckCard[]>(() => {
    const albumsById = new Map(albums.map((album) => [album.$id, album]));

    return entries.flatMap((entry) => {
      const album = albumsById.get(entry.albumId);

      if (!album) return [];

      return [{
        entryId: entry.entryId,
        album: {
          ...album,
          sideLetter: entry.sideLetter,
        },
      }];
    });
  }, [entries, albums]);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres((prev) => prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]);
  }, []);

  return {
    cards,
    queueMode,
    shuffleMode,
    selectedGenres,

    setShuffleMode,
    toggleGenre,
    toggleQueueMode,
    queueAlbum,
    clearQueue,
    nextCard,
  };
}