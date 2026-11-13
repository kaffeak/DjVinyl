import {Album} from "@/src/types/album";
import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import {isMatchingVinylRelease, selectBestRelease} from "@/src/utils/releaseMatching";

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

export function selectArtworkCandidate(album: ArtworkAlbum, releases: MusicBrainzRelease[]): ArtworkCandidate | null {
  const hasFront = Boolean(album.url?.trim());
  const hasBack = Boolean(album.backCoverUrl?.trim());

  if (hasFront && hasBack) return null;

  const candidates = releases.filter((release) => isMatchingVinylRelease(release, album.title, album.artist));

  const findBest = (predicate: (release: MusicBrainzRelease) => boolean)=> selectBestRelease(candidates.filter(predicate), album.title, album.artist);

  const pair = findBest((release) => release["cover-art-archive"]?.front === true && release["cover-art-archive"]?.back === true);

  if (pair) {
    return {
      kind: "pair",
      release: pair,
    };
  }

  if (hasFront) {
    const backOnly = findBest((release) => release["cover-art-archive"]?.back === true && release["cover-art-archive"]?.front !== true);

    return backOnly ? { kind: "back-only", release: backOnly} : null;
  }

  const frontOnly = findBest((release) => release["cover-art-archive"]?.front === true);

  return frontOnly ? { kind: "front-only", release: frontOnly} : null;
}