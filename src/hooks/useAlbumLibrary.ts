import {Album, NewAlbumData} from "@/src/types/album";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {getMetadataNeeds} from "@/src/utils/albumMetadata";
import {fetchAlbumArtwork, fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {createAlbum, deleteAlbum, listAlbums, updateAlbum} from "@/src/services/albumRepository";
import {buildArtworkChanges} from "@/src/utils/artworkChanges";

type LibraryAlbum = Album & {$id: string};

type MetadataRetryInfo = {
  attempts: number;
  nextAllowedAt: number;
};

export type ArtworkRefreshResult = | "updated" | "unchanged" | "skipped" | "busy" | "failed";

export type ArtworkPreview = {
  libraryId: string;
  albumId: string;
  releaseId: string;
  releaseTitle: string;
  releaseFormat: string;
  current: {
    frontUrl: string;
    backUrl: string;
  };
  proposed: {
    frontUrl: string;
    backUrl: string;
  };
  changes: ReturnType<typeof buildArtworkChanges>;
};

export type ArtworkPreviewSearchResult = | {status: "ready"; preview: ArtworkPreview;} | {status: "unchanged" | "skipped" | "busy" | "failed"};

export type BulkArtworkProgress = {
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  skipped: number;
  busy: number;
  failed: number;
  cancelled: boolean;
};

const MAX_METADATA_ATTEMPTS = 2;
const METADATA_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_AUTO_RETRIES_PER_LOAD = 3;

export function useAlbumLibrary(owner: string){
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedLibraryId, setLoadedLibraryId] = useState<string | null>(null);

  const [isBuilkArtworkRefreshing, setIsBuilkArtworkRefreshing] = useState(false);
  const [bulkArtworkProgress, setBulkArtworkProgress] = useState<BulkArtworkProgress | null>(null);
  const bulkArtworkInFlight = useRef(false);
  const albumsRef = useRef(albums);
  albumsRef.current = albums;
  const bulkArtworkRunning = useRef(false);

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

  const refreshAlbumArtwork = useCallback(
    async (albumId: string, force = false): Promise<ArtworkRefreshResult> => {
      //if (!owner || loadedLibraryId !== owner) return "skipped";
      if (!owner || loadedLibraryId !== owner || activeLibraryRef.current !== owner) return "skipped";

      //const album = albums.find((item) => item.$id === albumId);
      const album = albumsRef.current.find((item) => item.$id === albumId);

      if (!album) return "skipped";

      const hasFront = Boolean(album.url?.trim());
      const hasBack = Boolean(album.backCoverUrl?.trim());

      if (hasFront && hasBack && !force) return "skipped";

      const libraryId = owner;
      const key = `${libraryId}:${album.$id}`;

      if (metadataInFlight.current.has(key)) return "busy";

      metadataInFlight.current.add(key);

      try {
        const {candidate, artwork} = force ? await fetchAlbumArtwork(album, true) : await fetchAlbumArtwork(album);

        const changes = buildArtworkChanges(album, candidate, artwork, force);

        console.log("[ARTWORK:STATE UPDATE]", {
          activeLibrary: activeLibraryRef.current,
          libraryId,
          changes,
        });

        if (Object.keys(changes).length === 0) return "unchanged";

        if (activeLibraryRef.current !== libraryId) return "skipped";

        await updateAlbum(libraryId, album.$id, changes);

        if (activeLibraryRef.current === libraryId) {
          setAlbums((previous) => previous.map((item) => item.$id === album.$id ? { ...item, ...changes} : item));
        }

        return "updated";
      } catch (error) {
        console.error(
          "[ARTWORK:REFRESH:FAILED]",
          album.title,
          error
        );

        return "failed";
      } finally {
        metadataInFlight.current.delete(key);
      }
    }, [owner, loadedLibraryId] //[owner, loadedLibraryId, albums]
  );

  const previewAlbumArtwork = useCallback(async (albumId: string): Promise<ArtworkPreviewSearchResult> => {
    if (!owner || loadedLibraryId !== owner || activeLibraryRef.current !== owner) return {status: "skipped"};

    const album = albumsRef.current.find((item) => item.$id === albumId);

    if (!album) return {status: "skipped"};

    const libraryId = owner;
    const key = `${libraryId}:${albumId}`;

    if (metadataInFlight.current.has(key)) return {status: "busy"};

    metadataInFlight.current.add(key);

    try {
      const {candidate, artwork} = await fetchAlbumArtwork(album, true);

      if (activeLibraryRef.current !== libraryId) return {status: "skipped"};

      if (!candidate) return {status: "unchanged"};

      const changes = buildArtworkChanges(album, candidate, artwork, true);

      if (Object.keys(changes).length === 0) return {status: "unchanged"};

      const currentFront = album.url?.trim() ?? "";
      const currentBack = album.backCoverUrl?.trim() ?? "";

      const proposedFront = changes.url ?? currentFront;
      const proposedBack = changes.backCoverUrl ?? currentBack;

      const preview: ArtworkPreview = {
        libraryId,
        albumId,
        releaseId: candidate.release.id,
        releaseTitle: candidate.release.title ?? "",
        releaseFormat: candidate.release.media?.map((medium) => medium.format).filter(Boolean).join(", ") ?? "",
        current: {
          frontUrl: currentFront,
          backUrl: currentBack,
        },
        proposed: {
          frontUrl: proposedFront,
          backUrl: proposedBack,
        },
        changes,
      };

      console.log("[ARTWORK:PREVIEW:READY]", {
        albumId,
        releaseId: preview.releaseId,
        changes,
      });

      return {
        status: "ready",
        preview,
      };
    } catch (error) {
      console.error(
        "[ARTWORK:PREVIEW:FAILED]",
        albumId,
        error
      );

      return { status: "failed" };
    } finally {
      metadataInFlight.current.delete(key);
    }
  }, [owner, loadedLibraryId]);

  const applyArtworkPreview = useCallback(async (preview: ArtworkPreview): Promise<ArtworkRefreshResult> => {
    const libraryId = preview.libraryId;
    const albumId = preview.albumId;

    if (!owner || owner !== libraryId || loadedLibraryId !== libraryId || activeLibraryRef.current !== libraryId) return "skipped";

    const album = albumsRef.current.find((item) => item.$id === albumId);

    if (!album) return "skipped";

    if ((album.url?.trim() ?? "") !== preview.current.frontUrl || (album.backCoverUrl?.trim() ?? "") !== preview.current.backUrl) {
      console.warn(
        "[ARTWORK:PREVIEW:STALE]",
        albumId
      );

      return "skipped";
    }

    if (Object.keys(preview.changes).length === 0) return "unchanged";

    const key =  `${libraryId}:${albumId}`;

    if (metadataInFlight.current.has(key)) return "busy";

    metadataInFlight.current.add(key);

    try {
      if (activeLibraryRef.current !== libraryId) return "skipped";

      await updateAlbum(libraryId, albumId, preview.changes);

      if (activeLibraryRef.current === libraryId) {
        setAlbums((previous) => previous.map((item) => item.$id === albumId ? {...item, ...preview.changes} : item));
      }

      console.log("[ARTWORK:PREVIEW:APPLIED]", {
        albumId,
        releaseId: preview.releaseId,
      });

      return "updated";
    } catch (error) {
      console.error(
        "[ARTWORK:PREVIEW:APPLY_FAILED]",
        albumId,
        error
      );

      return "failed";
    } finally {
      metadataInFlight.current.delete(key);
    }
  }, [owner, loadedLibraryId]);

  const runArtworkMigration = useCallback(async () => {
    if (!owner || loadedLibraryId !== owner || activeLibraryRef.current !== owner || bulkArtworkInFlight.current) {
      console.log("[ARTWORK:MIGRATION] Not ready or already running");
      return;
    }

    const libraryId = owner;

    const incompleteAlbums = albums.filter(
      (album) =>
        !album.url?.trim() ||
        !album.backCoverUrl?.trim()
    );

    const summary: Record<ArtworkRefreshResult, number> = {
      updated: 0,
      unchanged: 0,
      skipped: 0,
      busy: 0,
      failed: 0,
    };

    bulkArtworkRunning.current = true;

    console.log(
      `[ARTWORK:MIGRATION] Starting: ${incompleteAlbums.length} albums`,
      { libraryId }
    );

    try {
      for (const [index, album] of incompleteAlbums.entries()) {
        // Stop if the user switches libraries.
        if (activeLibraryRef.current !== libraryId) {
          console.warn(
            "[ARTWORK:MIGRATION] Cancelled: library changed"
          );
          break;
        }

        console.log(
          `[ARTWORK:MIGRATION] ${index + 1}/${incompleteAlbums.length}`,
          `${album.artist} - ${album.title}`
        );

        const result = await refreshAlbumArtwork(album.$id);

        summary[result]++;

        console.log(
          `[ARTWORK:MIGRATION] Result: ${result}`,
          `${album.artist} - ${album.title}`
        );

        if (activeLibraryRef.current !== libraryId) {
          console.warn(
            "[ARTWORK:MIGRATION] Stopped after library change"
          );
          break;
        }
      }
    } finally {
      bulkArtworkRunning.current = false;

      console.log("[ARTWORK:MIGRATION] Finished", {
        libraryId,
        totalEligible: incompleteAlbums.length,
        ...summary,
      });
    }
  }, [owner, loadedLibraryId, albums, refreshAlbumArtwork]);

  const refreshMissingArtwork = useCallback( async (): Promise<BulkArtworkProgress | null> => {
    if (!owner || loadedLibraryId !== owner || activeLibraryRef.current !== owner || bulkArtworkInFlight.current) return null;

    const libraryId = owner;

    const eligibleAlbums = albums.filter((album) => {
      const hasFront = Boolean(album.url?.trim());
      const hasBack = Boolean(album.backCoverUrl?.trim());

      return !hasFront || !hasBack;
    });

    const progress: BulkArtworkProgress = {
      total: eligibleAlbums.length,
      processed: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      busy: 0,
      failed: 0,
      cancelled: false,
    };

    bulkArtworkInFlight.current = true;
    setIsBuilkArtworkRefreshing(true);
    setBulkArtworkProgress({ ...progress});

    try {
      for (const album of eligibleAlbums) {
        if (activeLibraryRef.current !== libraryId) {
          progress.cancelled = true;
          break;
        }

        const result = await refreshAlbumArtwork(album.$id);

        if (activeLibraryRef.current !== libraryId) {
          progress.cancelled = true;
          break;
        }

        progress.processed += 1;
        progress[result] += 1;

        setBulkArtworkProgress({ ...progress});
      }

      return {...progress};
    } finally {
      bulkArtworkInFlight.current = false;
      setIsBuilkArtworkRefreshing(false);
    }
  }, [owner, loadedLibraryId, albums, refreshAlbumArtwork]);

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
    refreshAlbumArtwork,
    previewAlbumArtwork,
    applyArtworkPreview,

    refreshMissingArtwork,
    isBuilkArtworkRefreshing,
    bulkArtworkProgress,

    runArtworkMigration,
  };
}