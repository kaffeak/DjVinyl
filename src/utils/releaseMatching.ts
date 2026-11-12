import {MusicBrainzRelease} from "@/src/types/musicBrainz";

function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function getCreditedArtist(release: MusicBrainzRelease): string {
  return (release["artist-credit"] ?? []).map((part) => typeof part === "string" ? part : part.name ?? part.artist?.name ?? "").join("").trim();
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