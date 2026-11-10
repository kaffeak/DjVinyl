import {Album} from "@/src/types/album";

export function getMetadataNeeds(album: Album) {
  const needsCover = !album.url?.trim();

  const needsTracks = !album.trackList?.length || album.trackList.some((track) => track.includes("NaN:NaN") || / - \d+:\d{3,}$/.test(track));

  return {needsCover, needsTracks};
}