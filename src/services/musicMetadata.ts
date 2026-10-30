export interface AlbumMetadata {
  coverUrl: string | null;
  trackList: string[];
}

interface MusicBrainzRelese {
  id: string;
  "release-group"? : {id: string};
}

interface ReleaseSearchResponse {
  releases?: MusicBrainzRelese[];
}

interface Track {
  title?: string;
  lenght?: number | null;
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
    image?: string;
    thumbnails?: Record<string, string>;
  }[];
}

const apiHeaders = {
  "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)",
  Accept: "application/json",
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let requestQueue: Promise<unknown> = Promise.resolve();

function fetchMusicBrainz(url: string): Promise<Response> {
  const job = requestQueue.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {headers: apiHeaders});
      await delay(1100);

      if ((response.status !== 503 && response.status !== 429) || attempt === 2){
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

  const durationMs = track.lenght ?? track.recording?.length;

  if (durationMs == null || !Number.isFinite(durationMs)) return title;

  const minutes = Math.floor(durationMs / 60000);


  const seconds = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, "0");

  return `${track.title} - ${minutes}:${seconds}`;
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

async function fetchCoverArt(releaseId: string, releaseGroupId?: string): Promise<string | null> {
  const releaseUrl =  `https://coverartarchive.org/release/${releaseId}/`;

  let response = await fetch(releaseUrl, {headers: apiHeaders,});

  console.log("[CAA:RELEASE]", {
    releaseId,
    status: response.status,
  });

  if (response.status === 404 && releaseGroupId) {
    const groupUrl = `https://coverartarchive.org/release-group/${releaseGroupId}/`;

    response = await fetch(groupUrl, {headers: apiHeaders,});
    console.log("[CAA:RELEASE-GROUP]", {
      releaseGroupId,
      status: response.status,
    })
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Cover art request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoverArtResponse;

  const images = data.images ?? [];

  const frontImage = images.find((image) => image.front) ?? images[0];

  const imageUrl =
    frontImage?.thumbnails?.["500"] ??
    frontImage?.thumbnails?.["1200"] ??
    frontImage?.image;

  console.log("[CAA:RESULT]", {
    imageUrl: imageUrl ?? null,
  })
  return imageUrl ? imageUrl.replace(/^http:\/\//, "https://") : null;
}

export async function fetchAlbumMetadata( title: string, artist: string): Promise<AlbumMetadata> {
  const params = new URLSearchParams({query: `release:${title} AND artist:${artist}`, fmt: "json"});

  const searchUrl = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;

  const response = await fetchMusicBrainz(searchUrl);

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseSearchResponse;

  const release = data.releases?.[0];

  console.log("[MB:SEARCH]", {
    requestedTitle: title,
    requestedArtist: artist,
    statue: response.status,
    resultsFound: data.releases?.length,
    selectedRelese: release?.id ?? null,
  });

  if (!release) {
    return {coverUrl: null, trackList: []};
  }

  const releaseId = release.id;
  const releaseGroupId = release["release-group"]?.id;

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

  return {
    trackList: tracksResult.status === "fulfilled" ? tracksResult.value : [],
    coverUrl: coverResult.status === "fulfilled" ? coverResult.value : null,
  };
}