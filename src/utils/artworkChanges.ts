import {Album} from "@/src/types/album";
import {AlbumMetadata} from "@/src/services/musicMetadata";
import {AlbumUpdates} from "@/src/services/albumRepository";
import {ArtworkCandidate} from "@/src/utils/artworkSelection";

type ArtworkAlbum = Pick<Album, "url" | "backCoverUrl">;

type ArtworkUrls = Pick<AlbumMetadata, "coverUrl" | "backCoverUrl">;

type ArtworkChanges = Pick<AlbumUpdates, "url" | "backCoverUrl">;

export function buildArtworkChanges(album: ArtworkAlbum, candidate: ArtworkCandidate | null, artwork: ArtworkUrls): ArtworkChanges {
  const hasFront = Boolean(album.url?.trim());
  const hasBack = Boolean(album.backCoverUrl?.trim());

  const newFront = artwork.coverUrl?.trim() ?? "";
  const newBack = artwork.backCoverUrl?.trim() ?? "";

  if (hasFront && hasBack) return {};

  const changes: ArtworkChanges = {};

  if (!hasFront && hasBack) changes.backCoverUrl = "";

  if (!candidate) return changes;

  switch (candidate.kind) {
    case "pair": {
      if (newFront && newBack) {
        return {
          url: newFront,
          backCoverUrl: newBack,
        };
      }

      if (!hasFront && newFront) changes.url = newFront;

      return changes;
    }

    case "front-only": {
      if (!hasFront && newFront) changes.url = newFront;

      return changes;
    }

    case "back-only": {
      if (hasFront && newBack) changes.backCoverUrl = newBack;

      return changes;
    }
  }
}