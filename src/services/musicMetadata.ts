import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import {selectBestRelease} from "@/src/utils/releaseMatching";
import {ArtworkCandidate, selectArtworkCandidate} from "@/src/utils/artworkSelection";
import {Album} from "@/src/types/album";

export interface AlbumMetadata {
  coverUrl: string | null;
  backCoverUrl: string | null;
  trackList: string[];
}

interface ReleaseSearchResponse {
  releases?: MusicBrainzRelease[];
}

interface Track {
  title?: string;
  length?: number | null;
  recording?: {
    title?: string;
    length?: number | null;
  }
}

interface ReleaseDetailsResponse {
  media?: {
    tracks?: Track[];
  }[];
}

interface CoverArtResponse {
  images?: {
    front?: boolean;
    back?: boolean;
    types?: string[];
    image?: string;
    thumbnails?: Record<string, string>;
  }[];
}

interface ReleaseArtworkAvailability {
  artwork?: boolean;
  front?: boolean;
  back?: boolean;
  count?: number;
}

interface BrowsedRelease {
  id: string;
  title: string;
  "cover-art-archive"?: ReleaseArtworkAvailability;
  media?: {
    format?: string;
  }[];
}

interface ReleaseBrowseResponse {
  releases?: MusicBrainzRelease[];
  "release-count"?: number;
  "release-offset"?: number;
}

type  CoverImage = NonNullable<CoverArtResponse["images"]>[number];

type ArtworkResult = Pick<AlbumMetadata, "coverUrl" | "backCoverUrl">;

export interface AlbumArtworkLookup {
  candidate: ArtworkCandidate | null;
  artwork: ArtworkResult;
}

const apiHeaders = {
  "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)",
  Accept: "application/json",
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let requestQueue: Promise<unknown> = Promise.resolve();

async function fetchReleaseGroupReleases(groupId: string): Promise<MusicBrainzRelease[]> {
  const params = new URLSearchParams({
    "release-group": groupId,
    inc: "media artist-credits release-groups",
    fmt: "json",
    limit: "100",
  });
  const url = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;

  const response = await fetchMusicBrainz(url);

  if (!response.ok){
    throw new Error(`Release-group browse failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseBrowseResponse;

  console.log(
    "[MB:GROUP:ARTWORK]",
    data.releases?.map((release) => ({
      id: release.id,
      title: release.title,
      formats: release.media?.map(
        (medium) => medium.format
      ),
      artwork: release["cover-art-archive"],
    }))
  );

  return data.releases ?? [];
}

function getArtworkUrl(image?: CoverImage): string | null {
  const url = image?.thumbnails?.["500"] ??
    image?.thumbnails?.["1200"] ?? image?.image;

  return url ? url.replace(/^http:\/\//, "https://") : null;
}

function fetchMusicBrainz(url: string): Promise<Response> {
  const job = requestQueue.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {headers: apiHeaders});
      await delay(1100);

      const retryableStatuses = [429, 500, 502, 503, 504];

      if (!retryableStatuses.includes(response.status) || attempt === 2){
        return response;
      }

      await delay(2000 * 2 ** attempt);
    }

    throw new Error("Unexpected retry state");
  });

  requestQueue = job.then(
    () => undefined,
    () => undefined
  );

  return job;
}

function formatTrack(track: Track): string | null {
  const title = track.title ?? track.recording?.title;

  if (!title) return null;

  const durationMs = track.length ?? track.recording?.length;

  if (durationMs == null || !Number.isFinite(durationMs)) return title;

  const minutes = Math.floor(durationMs / 60000);


  const seconds = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, "0");

  return `${title} - ${minutes}:${seconds}`;
}

async function fetchTrackList( releaseId: string ): Promise<string[]> {
  try {
    const url = `https://musicbrainz.org/ws/2/release/` + `${encodeURIComponent(releaseId)}` + `?inc=recordings&fmt=json`;

    const response = await fetchMusicBrainz(url);

    if (!response.ok) {
      throw new Error(`Track list request failed: ${response.status}`);
    }

    const data = (await response.json()) as ReleaseDetailsResponse;

    const rawTracks = (data.media ?? []).flatMap((medium) => medium.tracks ?? []);

    console.log("[MB:TRACKS:RAW]", {
      releaseId,
      status: response.status,
      mediaCount: data.media?.length ?? 0,
      rawTrackCount: rawTracks.length,
      firstTrack: rawTracks[0] ?? null,
    })

    const tracks: string[] = [];

    for (const medium of data.media ?? []) {
      for (const track of medium.tracks ?? []) {
        const formatted = formatTrack(track);

        if (formatted !== null) {
          tracks.push(formatted);
        }
      }
    }
    console.log("[MB:TRACKS:PARSED]", {
      releaseId,
      parsedCount: tracks.length,
      firstParsedTrack: tracks[0] ?? null,
    });
    return tracks;
  } catch (error) {
    console.error("Failed to fetch track list: ", error);
    throw error;
  }
}

async function fetchCoverArt(releaseId: string, releaseGroupId?: string): Promise<ArtworkResult> {
  const releaseUrl =  `https://coverartarchive.org/release/${releaseId}/`;

  let response = await fetch(releaseUrl, {headers: apiHeaders,});

  console.log("[CAA:RELEASE]", {
    releaseId,
    status: response.status,
  });

  if (response.status === 404) {
    if (!releaseGroupId) {
      return {coverUrl: null, backCoverUrl: null};
    }

    const groupUrl = `https://coverartarchive.org/release-group/${releaseGroupId}/`;

    response = await fetch(groupUrl, {headers: apiHeaders,});
    console.log("[CAA:RELEASE-GROUP]", {
      releaseGroupId,
      status: response.status,
    })

    if (response.status === 404) return {coverUrl: null, backCoverUrl: null};

    if (!response.ok) {
      throw new Error(`Cover art request failed: ${response.status}`);
    }

    const groupData = (await response.json()) as CoverArtResponse;

    const images = groupData.images ?? [];

    console.log("[CAA:GROUP:IMAGES]", {
      images: images.map((image) => ({
        front: image.front,
        back: image.back,
        types: image.types,
      })),
    });

    const frontImage = images.find((image) => image.front) ?? images.find((image) => image.types?.includes("Front"));

    return {coverUrl: getArtworkUrl(frontImage), backCoverUrl: null,};

  }

  if (!response.ok) {
    throw new Error(`Cover art request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoverArtResponse;

  const images = data.images ?? [];

  const frontImage = images.find((image) => image.front) ?? images.find((image) => image.types?.includes("Front")) ?? images.find((image) => !image.back && !image.types?.includes("Back"));

  const backImage = images.find((image) => image.back) ?? images.find((image) => image.types?.includes("Back"));

  console.log("[CAA:BACK:DEBUG]", {
    releaseId,
    imageCount: images.length,
    backImages: images.filter(
      (image) =>
        image.back === true ||
        image.types?.includes("Back")
    ).length,
    selectedBackUrl:
      backImage?.thumbnails?.["500"] ??
      backImage?.image ??
      null,
  });

  return {coverUrl: getArtworkUrl(frontImage), backCoverUrl: getArtworkUrl(backImage)};
}

export async function fetchAlbumArtwork(album: Pick<Album, "title" | "artist" | "url" | "backCoverUrl">): Promise<AlbumArtworkLookup> {
  const emptyResult: AlbumArtworkLookup = {
    candidate: null,
    artwork: {
      coverUrl: null,
      backCoverUrl: null,
    },
  };

  if (album.url?.trim() && album.backCoverUrl?.trim()) return emptyResult;

  const params = new URLSearchParams({
    query: `release:${album.title} AND artist:${album.artist}`,
    fmt: "json",
  });

  const searchUrl = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;

  const response = await fetchMusicBrainz(searchUrl);

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseSearchResponse;

  const searchReleases = data.releases ?? [];

  const searchRelease = selectBestRelease(searchReleases, album.title, album.artist);

  if (!searchRelease) return emptyResult;

  const groupId = searchRelease["release-group"]?.id;

  let candidates = searchReleases;

  if (groupId) {
    const groupReleases = await fetchReleaseGroupReleases(groupId);

    if (groupReleases.length > 0){
      candidates = groupReleases;
    }
  }

  const candidate = selectArtworkCandidate(album, candidates);

  if (!candidate) return emptyResult;

  const artwork = await fetchCoverArt(candidate.release.id);

  return {candidate, artwork};
}

export async function fetchAlbumMetadata( title: string, artist: string): Promise<AlbumMetadata> {
  const params = new URLSearchParams({query: `release:${title} AND artist:${artist}`, fmt: "json"});

  const searchUrl = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;

  console.log(searchUrl);

  const response = await fetchMusicBrainz(searchUrl);

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseSearchResponse;

  const searchRelease = selectBestRelease(data.releases ?? [], title, artist);

  if (!searchRelease){
    return {
      coverUrl: null,
      backCoverUrl: null,
      trackList: [],
    };
  }

  const releaseGroupId = searchRelease["release-group"]?.id;

  let selectedRelease = searchRelease;

  if (releaseGroupId) {
    try {
      const groupReleases = await fetchReleaseGroupReleases(releaseGroupId);

      const bestGroupRelease = selectBestRelease(groupReleases, title, artist);

      if (bestGroupRelease) {
        selectedRelease = bestGroupRelease;
      }
    } catch (error) {
      console.warn("[MB:GROUP:BROWSE:FAILED]", error);
    }
  }

  const releaseId = selectedRelease.id;

  console.log("[MB:FINAL:SELECTED]", {
    releaseId,
    title: selectedRelease.title,
    formats: selectedRelease.media?.map(
      (medium) => medium.format
    ),
    artwork: selectedRelease["cover-art-archive"] ?? null,
  });

  const [tracksResult, coverResult] = await Promise.allSettled([
    fetchTrackList(releaseId),
    fetchCoverArt(releaseId, releaseGroupId),
  ]);

  if (tracksResult.status === "rejected") {
    console.warn("Track list lookup failed:", tracksResult.reason);
  }

  if (coverResult.status === "rejected") {
    console.warn("Cover art lookup failed:", coverResult.reason);
  }

  if (tracksResult.status === "rejected" && coverResult.status === "rejected") {
    throw new Error("Both metadata request failed");
  }

  const artwork = coverResult.status === "fulfilled" ? coverResult.value : {
    coverUrl: null,
    backCoverUrl: null,
  };

  return {
    trackList: tracksResult.status === "fulfilled" ? tracksResult.value : [],
    ...artwork,
  };
}