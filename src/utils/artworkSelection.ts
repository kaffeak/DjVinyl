import {Album} from "@/src/types/album";
import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import {
  isMatchingCdRelease,
  isMatchingVinylRelease,
  rankReleases,
  selectBestRelease
} from "@/src/utils/releaseMatching";
import {release} from "node:os";

type ArtworkAlbum = Pick<Album, "title" | "artist" | "url" | "backCoverUrl">;

export type ArtworkCandidate =
  | {
    kind: "pair";
    release: MusicBrainzRelease;
  } | {
    kind: "front-only";
    release: MusicBrainzRelease;
  } | {
    kind: "back-only";
    release: MusicBrainzRelease;
};

export function rankArtworkCandidates(album: ArtworkAlbum, releases: MusicBrainzRelease[], force = false): ArtworkCandidate[] {
  const hasFront = Boolean(album.url?.trim());
  const hasBack = Boolean(album.backCoverUrl?.trim());

  if (hasFront && hasBack && !force) return [];

  const vinylReleases = releases.filter((release) => isMatchingVinylRelease(release, album.title, album.artist));

  const vinylIds = new Set(vinylReleases.map((release) => release.id));

  const cdReleases = releases.filter((release) => !vinylIds.has(release.id) && isMatchingCdRelease(release, album.title, album.artist));

  const candidates: ArtworkCandidate[] = [];
  const addedIds = new Set<string>();

  const addCandidates = (kind: ArtworkCandidate["kind"], source: MusicBrainzRelease[], predicate: (release: MusicBrainzRelease) => boolean) => {
    const ranked = rankReleases(source.filter(predicate), album.title, album.artist);

    for (const release of ranked) {
      if (addedIds.has(release.id)) continue;

      addedIds.add(release.id);
      candidates.push({kind, release});
    }
  };

  const hasPair = (release: MusicBrainzRelease) => release["cover-art-archive"]?.front === true && release["cover-art-archive"]?.back === true;

  const isBackOnly = (release: MusicBrainzRelease) => release["cover-art-archive"]?.front !== true && release["cover-art-archive"]?.back === true;

  const isFrontOnly = (release: MusicBrainzRelease) => release["cover-art-archive"]?.front === true && release["cover-art-archive"]?.back !== true;

  if (hasFront && hasBack) {
    addCandidates("pair", vinylReleases, hasPair);
    addCandidates("pair", cdReleases, hasPair);

    return candidates;
  }

  addCandidates("pair", vinylReleases, hasPair);

  if (hasFront){
    addCandidates("back-only", vinylReleases, isBackOnly);

    addCandidates("pair", cdReleases, hasPair);

    addCandidates("back-only", cdReleases, isBackOnly);
  } else {
    addCandidates("pair", cdReleases, hasPair);

    addCandidates("front-only", vinylReleases, isFrontOnly);

    addCandidates("front-only", cdReleases, isFrontOnly);
  }

  return candidates;
}

export function selectArtworkCandidate(album: ArtworkAlbum, releases: MusicBrainzRelease[]): ArtworkCandidate | null {
  return rankArtworkCandidates(album, releases)[0] ?? null;
}