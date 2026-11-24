import {MusicBrainzRelease, MusicBrainzReleaseGroup} from "@/src/types/musicBrainz";
import {
  isMatchingAlbumIdentity,
  isMatchingAlbumWithSingleTypo,
  normalizeText,
  selectBestRelease
} from "@/src/utils/releaseMatching";
import {ArtworkCandidate, rankArtworkCandidates, selectArtworkCandidate} from "@/src/utils/artworkSelection";
import {Album} from "@/src/types/album";
import {assertRegexLiteral} from "@babel/types";

export interface AlbumMetadata {
  coverUrl: string | null;
  backCoverUrl: string | null;
  trackList: string[];
}

interface ReleaseSearchResponse {
  releases?: MusicBrainzRelease[];
}

interface ReleaseGroupSearchResponse {
  "release-groups"?: MusicBrainzReleaseGroup[];
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

async function findMatchingReleaseGroups(title: string, artist: string): Promise<MusicBrainzReleaseGroup[]> {
  const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  const params = new URLSearchParams({
    query: `releasegroup:${quote(title)} AND artist:${quote(artist)}`,
    fmt: "json",
    limit: "50",
  });

  const url = `https://musicbrainz.org/ws/2/release-group/?${params}`;

  const response = await fetchMusicBrainz(url);

  if (!response.ok){
    throw new Error(`Release-group search failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseGroupSearchResponse;

  const matchingGroups = (data["release-groups"] ?? []).filter((group) => isMatchingAlbumIdentity(group, title, artist)).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0,3);

  console.log("[MB:GROUP:SEARCH]", {
    requestedTitle: title,
    requestedArtist: artist,
    returned: data["release-groups"]?.length ?? 0,
    matchingGroups: matchingGroups.map((group) => ({
      id: group.id,
      title: group.title,
      score: group.score,
    })),
  });

  return matchingGroups;
}

async function findTypoMatchingReleaseGroups(title: string, artist: string): Promise<MusicBrainzReleaseGroup[]> {
  const words = normalizeText(title).split(" ").filter(Boolean);

  const eligibleIndices = words.map((word, index) => ({word, index})).filter(({word}) => word.length >= 6 && !/\d/.test(word)).slice(0, 3);

  const quote = (value: string) => `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

  const matchingGroups = new Map<string, MusicBrainzReleaseGroup>();

  for (const { index } of eligibleIndices){
    const titleQuery = words.map((word, i) => `releasegroup:${word}${i === index ? "~0.8" : ""}`).join(" AND ");

    const query = `${titleQuery} AND artist:${quote(artist)}`;

    const params = new URLSearchParams({
      query,
      fmt: "json",
      limit: "25",
    });

    const url = `https://musicbrainz.org/ws/2/release-group/?${params}`;

    const response = await fetchMusicBrainz(url);

    if (!response.ok){
      throw new Error(`Fuzzy release-group search failed: ${response.status}`);
    }

    const data = (await response.json()) as ReleaseGroupSearchResponse;

    for (const group of data["release-groups"] ?? []){
      if (isMatchingAlbumWithSingleTypo(group, title, artist)) matchingGroups.set(group.id, group);
    }
  }

  const results = [...matchingGroups.values()].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));

  console.log("[MB:GROUP:TYPO]", {
    requestedTitle: title,
    requestedArtist: artist,
    searchAttempts: eligibleIndices.length,
    matchingGroups: results.map((group) => ({
      id: group.id,
      title: group.title,
    })),
  });

  return results;
}

async function findMatchingArtworkReleases(title: string, artist: string): Promise<MusicBrainzRelease[]> {
  const quote = (value: string) =>
    `"${value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')}"`;

  const params = new URLSearchParams({
    query: `release:${quote(title)} AND artist:${quote(artist)}`,
    fmt: "json",
    limit: "50",
  });

  const url = `https://musicbrainz.org/ws/2/release/?${params}`;

  const response = await fetchMusicBrainz(url);

  if (!response.ok) {
    throw new Error(`Fallback release search failed: ${response.status}`);
  }

  const data = (await response.json()) as ReleaseSearchResponse;

  const matchingReleases = (data.releases ?? []).filter((release) => isMatchingAlbumIdentity(release, title, artist));

  console.log("[MB:RELEASE:FALLBACK]", {
    requestedTitle: title,
    requestedArtist: artist,
    searchResults: data.releases?.length ?? 0,
    matchingReleases: matchingReleases.length,
    groupIds: [
      ...new Set(
        matchingReleases
          .map((release) => release["release-group"]?.id)
          .filter(Boolean)
      ),
    ],
  });

  return matchingReleases;
}

async function fetchReleaseGroupReleases(groupId: string): Promise<MusicBrainzRelease[]> {
  const PAGE_LIMIT = 100;
  const MAX_PAGES = 20;

  const allReleases: MusicBrainzRelease[] = [];

  let offset = 0;
  let totalCount: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      "release-group": groupId,
      inc: "media artist-credits release-groups",
      fmt: "json",
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });

    const url = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;

    const response = await fetchMusicBrainz(url);

    if (!response.ok) {
      throw new Error(`Release-group browse failed: ${response.status}`);
    }

    const data = (await response.json()) as ReleaseBrowseResponse;

    const pageReleases = data.releases ?? [];

    if (totalCount === null && typeof data["release-count"] === "number" && Number.isSafeInteger(data["release-count"]) && data["release-count"] >= 0) {
      totalCount = data["release-count"];
    }

    console.log("[MB:GROUP:PAGE]", {
      groupId,
      page: page + 1,
      offset,
      received: pageReleases.length,
      totalCount,
    });

    if (pageReleases.length === 0) break;

    allReleases.push(...pageReleases);

    offset += pageReleases.length;

    if (totalCount !== null && offset >= totalCount) break;

    if (totalCount === null) break;

    if (page === MAX_PAGES - 1) {
      console.warn("[MB:GROUP:PAGE_LIMIT]", {
        groupId,
        fetched: allReleases.length,
        totalCount,
      });
    }
  }

  console.log("[MB:GROUP:ARTWORK]", {
    groupId,
    fetched: allReleases.length,
    totalCount,
    vinylReleases: allReleases.filter((release) =>
      release.media?.some((medium) =>
        /\bvinyl\b/i.test(medium.format ?? "")
      )
    ).length,
  });

  return allReleases;
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

function classifyFetchedArtwork(hasExistingFront: boolean, candidate: ArtworkCandidate, artwork: ArtworkResult): ArtworkCandidate | null {
  const hasNewFront = Boolean(artwork.coverUrl?.trim());
  const hasNewBack = Boolean(artwork.backCoverUrl?.trim());

  if (hasExistingFront){
    if (!hasNewBack) return null;

    if (hasNewFront){
      return {
        kind: "pair",
        release: candidate.release,
      };
    }

    return {
      kind: "back-only",
      release: candidate.release,
    };
  }

  if (!hasNewFront) return null;

  if (hasNewBack) {
    return {
      kind: "pair",
      release: candidate.release,
    };
  }

  return {
    kind: "front-only",
    release: candidate.release,
  };
}

function getArtworkPriority(hasExistingFront: boolean, candidate: ArtworkCandidate): number {
  const isVinyl = candidate.release.media?.some((medium) =>  /\bvinyl\b/i.test(medium.format ?? "") ?? false);

  if (hasExistingFront) {
    if (candidate.kind === "pair") return isVinyl ? 0 : 2;

    if (candidate.kind === "back-only") return isVinyl ? 1 : 3;

    return 4;
  }

  if (candidate.kind === "pair") return isVinyl ? 0 : 1;

  if (candidate.kind === "front-only") return isVinyl ? 2 : 3;

  return 4;
}

export async function fetchAlbumArtwork(album: Pick<Album, "title" | "artist" | "url" | "backCoverUrl">, force = false): Promise<AlbumArtworkLookup> {
  const emptyResult: AlbumArtworkLookup = {
    candidate: null,
    artwork: {
      coverUrl: null,
      backCoverUrl: null,
    },
  };

  if (album.url?.trim() && album.backCoverUrl?.trim() && !force) return emptyResult;

  const groups = await findMatchingReleaseGroups(album.title, album.artist);

  const releaseById = new Map<string, MusicBrainzRelease>();

  const browsedGroupIds = new Set(groups.map((group) => group.id));

  for (const group of groups) {
    const releases = await fetchReleaseGroupReleases(group.id);

    for (const release of releases){
      releaseById.set(release.id, release);
    }
  }

  let rankedCandidates = rankArtworkCandidates(album, [...releaseById.values()], force);

  if (rankedCandidates.length === 0){
    console.log("[ARTWORK:FALLBACK:START]", {
      album: `${album.artist} - ${album.title}`,
      groupsChecked: groups.length,
    });

    const matchingReleases = await findMatchingArtworkReleases(album.title, album.artist);

    for (const release of matchingReleases) {
      if (!releaseById.has(release.id)) {
        releaseById.set(release.id, release);
      }
    }

    const fallbackGroupIds = [...new Set(matchingReleases.map((release) => release["release-group"]?.id).filter((id): id is string => Boolean(id)),)].filter((id) => !browsedGroupIds.has(id)).slice(0, 3);

    for (const groupId of fallbackGroupIds) {
      browsedGroupIds.add(groupId);

      const releases = await fetchReleaseGroupReleases(groupId);

      for (const release of releases) {
        releaseById.set(release.id, release);
      }
    }

    rankedCandidates = rankArtworkCandidates(album, [...releaseById.values()], force);

    console.log("[ARTWORK:FALLBACK:RESULT]", {
      album: `${album.artist} - ${album.title}`,
      matchingReleases: matchingReleases.length,
      additionalGroups: fallbackGroupIds.length,
      candidates: rankedCandidates.length,
    });
  }

  if (rankedCandidates.length === 0) {
    console.log("[ARTWORK:TYPO:START]", {
      album: `${album.artist} - ${album.title}`,
    });

    const typoGroups = await findTypoMatchingReleaseGroups(album.title, album.artist);

    const canonicalTitle = typoGroups[0]?.title;

    if (canonicalTitle) {
      const ambiguous = typoGroups.some((group) => !isMatchingAlbumIdentity(group, canonicalTitle, album.artist));

      if (ambiguous) {
        console.warn("[ARTWORK:TYPO:AMBIGUOUS]", {
          album: `${album.artist} - ${album.title}`,
          possibleTitles: typoGroups.map(
            (group) => group.title
          ),
        });
      } else {
        const typoReleases: MusicBrainzRelease[] = [];

        for (const group of typoGroups.slice(0, 3)) {
          const releases = await fetchReleaseGroupReleases(group.id);

          typoReleases.push(...releases);
        }

        const matchingAlbum = {
          ...album,
          title: canonicalTitle,
        };

        rankedCandidates = rankArtworkCandidates(matchingAlbum, typoReleases, force);

        console.log("[ARTWORK:TYPO:RESULT]", {
          originalTitle: album.title,
          matchedTitle: canonicalTitle,
          groupsChecked: Math.min(typoGroups.length, 3),
          releasesChecked: typoReleases.length,
          candidates: rankedCandidates.length,
        });
      }
    }
  }

  if (rankedCandidates.length === 0){
    console.log("[ARTWORK:NO_CANDIDATE]", {
      album: `${album.artist} - ${album.title}`,
      groupsChecked: browsedGroupIds.size,
      releasesChecked: releaseById.size,
    });

    return emptyResult;
  }

  const hasExistingFront = Boolean(album.url?.trim());

  const replacingCompletePair = force && Boolean(album.url?.trim()) &&  Boolean(album.backCoverUrl?.trim());

  let bestResult: {
    priority: number;
    lookup: AlbumArtworkLookup;
  } | null = null;

  let firstError: unknown = null;

  const MAX_ATTEMPTS_PER_PRIORITY = 5;
  const attemptsByPriority = new Map<number, number>();

  for (const candidate of rankedCandidates){
    const advertisedPriority = getArtworkPriority(hasExistingFront, candidate);

    if (bestResult !== null && advertisedPriority >= bestResult.priority) break;

    const attempts = attemptsByPriority.get(advertisedPriority) ?? 0;

    if (attempts >= MAX_ATTEMPTS_PER_PRIORITY) continue;

    attemptsByPriority.set(advertisedPriority, attempts + 1);

    let artwork: ArtworkResult;

    try {
      artwork = await fetchCoverArt(candidate.release.id);
    } catch (error) {
      if (firstError === null) firstError = error;

      console.warn("[ARTWORK:CANDIDATE:FAILED]", {
        releaseId: candidate.release.id,
        error,
      });

      continue;
    }

    const actualCandidate = classifyFetchedArtwork(hasExistingFront, candidate, artwork);

    if (replacingCompletePair && actualCandidate?.kind !== "pair") continue;

    console.log("[ARTWORK:CANDIDATE:CHECKED]", {
      releaseId: candidate.release.id,
      advertisedKind: candidate.kind,
      actualKind: actualCandidate?.kind ?? null,
      fetchedFront: Boolean(artwork.coverUrl),
      fetchedBack: Boolean(artwork.backCoverUrl),
    });

    if (!actualCandidate) continue;

    const isIdenticalPair = replacingCompletePair && actualCandidate.kind === "pair" && artwork.coverUrl?.trim() === album.url?.trim() && artwork.backCoverUrl?.trim() === album.backCoverUrl?.trim();

    if (isIdenticalPair) {
      console.log("[ARTWORK:CANDIDATE:IDENTICAL]", {
        releaseId: candidate.release.id,
        frontUrl: artwork.coverUrl,
        backUrl: artwork.backCoverUrl,
      });

      continue;
    }



    const priority = getArtworkPriority(hasExistingFront, actualCandidate);

    if (bestResult === null || priority < bestResult.priority) {
      bestResult = {
        priority,
        lookup: {
          candidate: actualCandidate,
          artwork,
        },
      };
    }

    if (priority === 0) break;
  }

  if (bestResult !== null) {
    console.log("[ARTWORK:SELECTED]", {
      album: `${album.artist} - ${album.title}`,
      releaseId: bestResult.lookup.candidate?.release.id,
      kind: bestResult.lookup.candidate?.kind,
      priority: bestResult.priority,
    });

    return bestResult.lookup;
  }

  if (firstError !== null) throw firstError;

  console.log("[ARTWORK:NO_USABLE_ARTWORK]", {
    album: `${album.artist} - ${album.title}`,
    candidates: rankedCandidates.length,
  });

  return emptyResult;
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