import {Album, NewAlbumData} from "@/src/types/album";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {getMetadataNeeds} from "@/src/utils/albumMetadata";
import {fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {createAlbum, deleteAlbum, listAlbums, updateAlbum} from "@/src/services/albumRepository";

type LibraryAlbum = Album & {$id: string};

type MetadataRetryInfo = {
  attempts: number;
  nextAllowedAt: number;
};

const MAX_METADATA_ATTEMPTS = 2;
const METADATA_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_AUTO_RETRIES_PER_LOAD = 3;

export function useAlbumLibrary(owner: string){
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedLibraryId, setLoadedLibraryId] = useState<string | null>(null);

  const metadataInFlight = useRef(new Set<string>());
  const metadataRetryInfo = useRef(new Map<string, MetadataRetryInfo>());
  const activeLibraryRef = useRef(owner);
  activeLibraryRef.current = owner;

  const allGenres = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const album of albums) {
      for (const genre of album.genres) {
        counts[genre] = (counts[genre] ?? 0) + 1;
      }
    }

    return counts;
  }, [albums]);

  const canLoadMetadata = useCallback(
    (album: LibraryAlbum, libraryId: string): boolean => {

      const { needsCover, needsTracks } = getMetadataNeeds(album);

      if (!needsCover && !needsTracks) return false;

      const key = `${libraryId}:${album.$id}`;

      if (metadataInFlight.current.has(key)) return false;

      const retryInfo = metadataRetryInfo.current.get(key);

      if (!retryInfo) return true;

      if (retryInfo.attempts >= MAX_METADATA_ATTEMPTS) return false;

      return Date.now() >= retryInfo.nextAllowedAt;
    },
    []
  );

  const loadAlbumMetadata = useCallback(
    async (album: LibraryAlbum, libraryId: string) => {
      if (!canLoadMetadata(album, libraryId)) return;

      const key = `${libraryId}:${album.$id}`;
      const { needsCover, needsTracks } = getMetadataNeeds(album);

      const previous = metadataRetryInfo.current.get(key);

      metadataRetryInfo.current.set(key, {
        attempts: (previous?.attempts ?? 0) + 1,
        nextAllowedAt: 0,
      });

      metadataInFlight.current.add(key);

      try {
        console.log("[METADATA:START]", album.title);

        const metadata = await fetchAlbumMetadata(album.title, album.artist);

        console.log("[METADATA:RECEIVED]", metadata);

        const {coverUrl, backCoverUrl, trackList,} = metadata;

        const changes: { url?: string; backCoverUrl?: string; trackList?: string[]; } = {};

        if (needsCover && coverUrl) changes.url = coverUrl;

        const effectiveFrontUrl = changes.url?.trim() || album.url?.trim();

        if (effectiveFrontUrl && !album.backCoverUrl?.trim() && backCoverUrl) {
          changes.backCoverUrl = backCoverUrl;
        }

        if (needsTracks && trackList.length > 0) changes.trackList = trackList;

        if (Object.keys(changes).length === 0) {
          console.warn("[METADATA:EMPTY]", album.title);
          return;
        }

        await updateAlbum(libraryId, album.$id, changes);

        if (activeLibraryRef.current === libraryId) {
          setAlbums((prev) => prev.map((item) => item.$id === album.$id ? {...item, ...changes} : item));
        }

        console.log("[METADATA:SAVED]", album.title);
      } catch (error) {
        console.log("[METADATA:FAILED]", album.title, error);
      } finally {
        const retryInfo = metadataRetryInfo.current.get(key);

        if (retryInfo) {
          metadataRetryInfo.current.set(key, {
            ...retryInfo,
            nextAllowedAt: Date.now() + METADATA_COOLDOWN_MS,
          });
        }

        metadataInFlight.current.delete(key);
      }
    },
    [canLoadMetadata]
  );

  useEffect(() => {
    let cancelled = false;

    setAlbums([]);
    setIsLoading(true);
    setLoadError(null);
    setLoadedLibraryId(null);

    if (!owner) {
      setIsLoading(false);
      return;
    }

    const loadLibrary = async () => {
      try {
        const docs = await listAlbums(owner);

        if (cancelled) return;

        const loadedAlbums: LibraryAlbum[] = docs.map(
          (doc) => ({
            $id: doc.$id,
            title: typeof doc.title === "string" ? doc.title : "",
            artist: typeof doc.artist === "string" ? doc.artist : "",
            url: typeof doc.url === "string" ? doc.url : "",
            backCoverUrl: typeof doc.backCoverUrl === "string" ? doc.backCoverUrl : "",
            sides: typeof doc.sides === "number" ? doc.sides : 2,
            genres: Array.isArray(doc.genres) ? doc.genres.filter((g: unknown): g is string => typeof g === "string") : [],
            trackList: Array.isArray(doc.trackList) ? doc.trackList.filter((t: unknown): t is string => typeof t === "string") : [],
          })
        );

        setAlbums(loadedAlbums);

        const albumsToRetry = loadedAlbums.filter((album) => canLoadMetadata(album, owner)).slice(0, MAX_AUTO_RETRIES_PER_LOAD);

        for (const album of albumsToRetry) {
          void loadAlbumMetadata(album, owner);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load library: ", error);
          setLoadError("Could not load the album library.");
        }
      } finally {
        if (!cancelled) {
          setLoadedLibraryId(owner);
          setIsLoading(false);
        }
      }
    };
    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [owner, canLoadMetadata, loadAlbumMetadata]);

  const addAlbum = useCallback(
    async (data: NewAlbumData): Promise<boolean> => {
      if (!owner) return false;

      const libraryId = owner;

      try {
        const newAlbum = await createAlbum(libraryId, data);

        const createRecord: LibraryAlbum = {
          $id: newAlbum.$id,
          title: data.title,
          artist: data.artist,
          sides: data.sides,
          genres: data.genres,
          url: typeof newAlbum.url === "string" ? newAlbum.url : "",
          backCoverUrl: typeof newAlbum.backCoverUrl === "string" ? newAlbum.backCoverUrl : "",
          trackList: Array.isArray(newAlbum.trackList) ? newAlbum.trackList : [],
        };

        if (activeLibraryRef.current === libraryId) setAlbums((prev) => [...prev, createRecord]);

        void loadAlbumMetadata(createRecord, libraryId);

        return true;
      } catch (error) {
        console.error("Failed to create album: ", error);
        return false;
      }
    },
    [owner, loadAlbumMetadata]
  );

  const updateGenres = async (albumTitle: string, albumArtist: string, newGenres: string[]) => {
    const album = albums.find((a) => a.title === albumTitle && a.artist === albumArtist);

    if (!album || !owner) return;

    const libraryId = owner;

    try {
      await updateAlbum(libraryId, album.$id, { genres: newGenres,});

      if (activeLibraryRef.current === libraryId) {
        setAlbums((prev) => prev.map((item) => item.$id === album.$id ? {...item, genres: newGenres} : item));
      }
    } catch (error) {
      console.error("Failed to update genres: ", error);
    }
  };

  const removeAlbum = async (albumToRemove: Album) => {
    const album = albums.find((a) => albumToRemove.$id ? a.$id === albumToRemove.$id : a.title === albumToRemove.title && a.artist === albumToRemove.artist);

    if (!album || !owner) return;

    const libraryId = owner;

    try {
      await deleteAlbum(libraryId, album.$id);

      if (activeLibraryRef.current === libraryId) setAlbums((prev) => prev.filter((item) => item.$id !== album.$id));
    } catch (error) {
      console.error("Failed to remove album: ", error);
    }
  };

  return {
    albums,
    allGenres,
    isLoading,
    loadError,
    loadedLibraryId,

    addAlbum,
    removeAlbum,
    updateGenres,
  };
}