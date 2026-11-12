export interface MusicBrainzRelease {
  id: string;
  title?: string;
  score?: number | string;
  status?: string;

  "artist-credit"?: Array< | string | {
    name?: string;
    artist?: {
      name?: string;
    };
  }>;

  media?: {
    format?: string;
  }[];

  "release-group"?: {
    id: string;
    "primary-type"?: string;
  };

  "cover-art-archive"?: {
    artwork?: boolean;
    front?: boolean;
    back?: boolean;
    count?: number;
  };
}