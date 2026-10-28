export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[];
  trackList: string[];
  sideLetter?: string;
}

export type ShuffleMode = "albums" | "sides";