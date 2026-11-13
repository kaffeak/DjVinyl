import {Album} from "@/src/types/album";

export function getDisplayedCoverUrl(album: Pick<Album, "url" | "backCoverUrl">, showingTracks: boolean): string {
  const frontCover = album.url?.trim() ?? "";
  const backCover = album.backCoverUrl?.trim() ?? "";

  if (showingTracks && frontCover && backCover) return backCover;

  return frontCover;
}