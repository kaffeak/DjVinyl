import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import {selectArtworkCandidate} from "@/src/utils/artworkSelection";

const album = {
  title: "Killers",
  artist: "Iron Maiden",
  url: "",
  backCoverUrl: "",
};

function createRelease(id: string, front: boolean, back: boolean, format = '12" Vinyl'): MusicBrainzRelease {
  return {
    id,
    title: "Killers",
    "artist-credit": [{ name: "Iron Maiden" }],
    media: [{ format }],
    "cover-art-archive": {
      artwork: front || back,
      front,
      back,
    },
  };
}

describe("artworkSelection", () => {
  test("should skip albums with both covers",  () => {
    const completeAlbum = {
      ...album,
      url: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
    };

    const result = selectArtworkCandidate(completeAlbum, [createRelease("another-release", true, true)]);

    expect(result).toBeNull();
  });

  test("should prefer a release with both covers",  () => {
    const frontOnly = createRelease("front-only", true, false);

    const complete = createRelease("complete", true, true);

    const result = selectArtworkCandidate(album, [frontOnly, complete]);

    expect(result?.kind).toBe("pair");
    expect(result?.release.id).toBe("complete");
  });

  test("should use a back-only release when a front already exists",  () => {
    const albumWithFront = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const backOnly = createRelease("back-only", false, true);

    const result = selectArtworkCandidate(albumWithFront, [backOnly]);

    expect(result?.kind).toBe("back-only");
    expect(result?.release.id).toBe("back-only");
  });

  test("should not select a back-only release when no front exists",  () => {
    const backOnly = createRelease("back-only", false, true);

    const result = selectArtworkCandidate(album, [backOnly]);

    expect(result).toBeNull();
  });

  test("should fallback to front-only release",  () => {
    const backOnly = createRelease("back-only", false, true);
    const frontOnly = createRelease("front-only", true, false);

    const result = selectArtworkCandidate(album, [backOnly, frontOnly]);

    expect(result?.kind).toBe("front-only");
    expect(result?.release.id).toBe("front-only");
  });

  test("should reject incorrect artist",  () => {
    const incorrectArtist: MusicBrainzRelease = {
      ...createRelease("incorrect-artist", true, true),
      "artist-credit": [{ name: "Kiss" }],
    };

    const result = selectArtworkCandidate(album, [incorrectArtist]);

    expect(result).toBeNull();
  });
})