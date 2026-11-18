import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import useFakeTimers = jest.useFakeTimers;

export function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}


function isOneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }

  if (a === b) {
    return false;
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }

    edits++;

    if (edits > 1) {
      return false;
    }

    if (a.length > b.length) {
      i++;
    } else if (b.length > a.length) {
      j++;
    } else {
      i++;
      j++;
    }
  }

  edits += (a.length - i) + (b.length - j);

  return edits === 1;
}


export function hasSingleTitleTypo(requestedTitle: string, candidateTitle: string): boolean {
  const requested = normalizeText(requestedTitle);
  const candidate = normalizeText(candidateTitle);

  if (!requested || !candidate) return false;

  if(requested === candidate) return false;

  const requestedWords = requested.split(" ");
  const candidateWords = candidate.split(" ");

  if (requestedWords.length !== candidateWords.length) return false;

  let differentWords = 0;

  for (let i = 0; i < requestedWords.length; i++) {
    const wordA = requestedWords[i];
    const wordB = candidateWords[i];

    if (wordA === wordB) continue;

    differentWords++;

    if (differentWords > 1) return false;

    if (Math.min(wordA.length, wordB.length) < 6) return false;

    if (/\d/.test(wordA) || /\d/.test(wordB)) return false;

    if (!isOneEditApart(wordA, wordB)) return false;
  }

  return differentWords === 1;
}

export function isMatchingAlbumWithSingleTypo(release: MusicBrainzRelease, requestedTitle: string, requestedArtist: string): boolean {
  if (!release.title || !hasSingleTitleTypo(requestedTitle, release.title)) return false;

  const creditedArtist = getCreditedArtist(release);

  if (!creditedArtist) return false;

  return (normalizeText(creditedArtist) === normalizeText(requestedArtist));
}

function getCreditedArtist(release: MusicBrainzRelease): string {
  return (release["artist-credit"] ?? []).map((part) => typeof part === "string" ? part : part.name ?? part.artist?.name ?? "").join("").trim();
}

export function isMatchingAlbumIdentity(release: MusicBrainzRelease, title: string, artist: string): boolean {
  const creditedArtist = getCreditedArtist(release);

  const titleMatches = !!release.title && normalizeText(release.title) === normalizeText(title);

  const artistMatches = !!creditedArtist && normalizeText(creditedArtist) === normalizeText(artist);

  return titleMatches && artistMatches;
}

function scoreRelease(release: MusicBrainzRelease, requestedTitle: string, requestedArtist: string): number {
  let score = 0;

  if (release.title) {
    score += normalizeText(release.title) === normalizeText(requestedTitle) ? 100 : -100;
  }

  const creditedArtist = getCreditedArtist(release);

  if (creditedArtist) {
    score += normalizeText(creditedArtist) === normalizeText(requestedArtist) ? 100 : -100;
  }

  const formats = release.media?.map((medium) => medium.format ?? "") ?? [];

  const isVinyl = formats.some((format) => /\bvinyl\b/i.test(format));

  const is12InchVinyl = formats.some((format) => /^12" vinyl$/i.test(format.trim()));

  const artwork = release["cover-art-archive"];

  if (isVinyl) {
    if (artwork?.front){
      score += 10;
    }

    if (artwork?.back){
      score += 15;
    }

    score += 20;
  }

  if (is12InchVinyl) {
    score += 5;
  }

  if (release.status?.toLowerCase() === "official") {
    score += 5;
  }

  if (release["release-group"]?.["primary-type"]?.toLowerCase() === "album"){
    score += 5;
  }

  const relevance = Number(release.score);

  if (release.score !== undefined && Number.isFinite(relevance)) {
    score += Math.max(0, Math.min(relevance, 100)) / 10;
  }

  return score;
}

export function selectBestRelease(releases: MusicBrainzRelease[], title: string, artist: string): MusicBrainzRelease | null {
  if (releases.length === 0) return null;

  return  releases.reduce((best, candidate) => {
    const bestScore = scoreRelease(best, title, artist);
    const candidateScore = scoreRelease(candidate, title, artist);

    return candidateScore > bestScore ? candidate : best;
  });
}

export function rankReleases(releases: MusicBrainzRelease[], title: string, artist: string): MusicBrainzRelease[] {
  return [...releases].sort((a, b) => scoreRelease(b, title, artist) - scoreRelease(a, title, artist));
}

export function isMatchingVinylRelease(release: MusicBrainzRelease, title: string, artist: string): boolean {
  const isVinyl = release.media?.some((medium) => /\bvinyl\b/i.test(medium.format ?? "")) ?? false;

  return (isMatchingAlbumIdentity(release, title, artist) && isVinyl);
}

export function isMatchingCdRelease(release: MusicBrainzRelease, title: string, artist: string): boolean {
  const isCd =
    release.media?.some((medium) => {
      const format = medium.format?.trim() ?? "";

      return /^(CD|CD-R)$/i.test(format);
    }) ?? false;

  return ( isMatchingAlbumIdentity(release, title, artist) && isCd);
}