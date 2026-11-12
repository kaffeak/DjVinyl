export interface Album {
  $id?: string;
  title: string;
  artist: string;
  url: string;
  backCoverUrl?: string;
  sides: number;
  genres: string[];
  trackList: string[];
  sideLetter?: string;
}

export interface DeckEntry {
  entryId: string;
  albumId: string;
  sideLetter?: string;
}

export type ShuffleMode = "albums" | "sides";

export type NewAlbumData = Pick<Album, "title" | "artist" | "sides" | "genres" >;