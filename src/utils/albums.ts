import {Album} from "@/src/types/album";

export function shuffleArray<T>(array: readonly T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildSidesList(albums: readonly Album[]): Album[] {
  return albums.flatMap((album) =>
    Array.from({ length: album.sides }, (_, i) => ({
      ...album,
      side: i + 1,
      sideLetter: String.fromCharCode(65 + i),
    }))
  )
}