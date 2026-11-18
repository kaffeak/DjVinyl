import {MusicBrainzRelease} from "@/src/types/musicBrainz";
import {rankArtworkCandidates, selectArtworkCandidate} from "@/src/utils/artworkSelection";

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

  test("should prefer vinyl pair over CD pair", () => {
    const cdPair = createRelease(
      "cd-pair",
      true,
      true,
      "CD"
    );

    const vinylPair = createRelease(
      "vinyl-pair",
      true,
      true,
      '12" Vinyl'
    );

    const result = selectArtworkCandidate(
      album,
      [cdPair, vinylPair]
    );

    expect(result?.kind).toBe("pair");
    expect(result?.release.id).toBe("vinyl-pair");
  });

  test("should fallback to CD pair when vinyl has no back cover", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const vinylFront = createRelease(
      "vinyl-front",
      true,
      false,
      '12" Vinyl'
    );

    const cdPair = createRelease(
      "cd-pair",
      true,
      true,
      "CD"
    );

    const result = selectArtworkCandidate(
      existingAlbum,
      [vinylFront, cdPair]
    );

    expect(result?.kind).toBe("pair");
    expect(result?.release.id).toBe("cd-pair");
  });

  test("should prefer vinyl back-only over CD pair", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const vinylBack = createRelease(
      "vinyl-back",
      false,
      true,
      '12" Vinyl'
    );

    const cdPair = createRelease(
      "cd-pair",
      true,
      true,
      "CD"
    );

    const result = selectArtworkCandidate(
      existingAlbum,
      [cdPair, vinylBack]
    );

    expect(result?.kind).toBe("back-only");
    expect(result?.release.id).toBe("vinyl-back");
  });

  test("should use a CD back-only release when no vinyl back cover exists", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };
    const vinylFront = createRelease("vinyl-front", true, false, '12" Vinyl');

    const cdBack = createRelease("cd-back", false, true, "CD");

    const result = selectArtworkCandidate(existingAlbum, [vinylFront, cdBack]);

    expect(result?.kind).toBe("back-only");
    expect(result?.release.id).toBe("cd-back");
  });


  test("should rank all artwork candidates by priority", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const vinylPairA = {
      ...createRelease(
        "vinyl-pair-a",
        true,
        true,
        '12" Vinyl'
      ),
      score: 50,
    };

    const vinylPairB = {
      ...createRelease(
        "vinyl-pair-b",
        true,
        true,
        '12" Vinyl'
      ),
      score: 95,
    };

    const vinylBack = createRelease(
      "vinyl-back",
      false,
      true,
      '12" Vinyl'
    );

    const cdPair = createRelease(
      "cd-pair",
      true,
      true,
      "CD"
    );

    const cdBack = createRelease(
      "cd-back",
      false,
      true,
      "CD"
    );

    const ranked = rankArtworkCandidates(existingAlbum, [
      cdBack,
      vinylPairA,
      cdPair,
      vinylBack,
      vinylPairB,
    ]);

    expect(
      ranked.map(({ kind, release }) => ({
        kind,
        id: release.id,
      }))
    ).toEqual([
      { kind: "pair", id: "vinyl-pair-b" },
      { kind: "pair", id: "vinyl-pair-a" },
      { kind: "back-only", id: "vinyl-back" },
      { kind: "pair", id: "cd-pair" },
      { kind: "back-only", id: "cd-back" },
    ]);
  });


  test("should exclude back-only candidates when no front exists", () => {
    const vinylBack = createRelease(
      "vinyl-back",
      false,
      true
    );

    const cdPair = createRelease(
      "cd-pair",
      true,
      true,
      "CD"
    );

    const vinylFront = createRelease(
      "vinyl-front",
      true,
      false
    );

    const ranked = rankArtworkCandidates(album, [
      vinylBack,
      vinylFront,
      cdPair,
    ]);

    expect(
      ranked.map(({ kind, release }) => ({
        kind,
        id: release.id,
      }))
    ).toEqual([
      { kind: "pair", id: "cd-pair" },
      { kind: "front-only", id: "vinyl-front" },
    ]);
  });


  test("should return no candidates for complete albums", () => {
    const completeAlbum = {
      ...album,
      url: "https://example.com/front.jpg",
      backCoverUrl: "https://example.com/back.jpg",
    };

    const ranked = rankArtworkCandidates(
      completeAlbum,
      [
        createRelease("vinyl-pair", true, true),
        createRelease("cd-pair", true, true, "CD"),
      ]
    );

    expect(ranked).toEqual([]);
  });


  test("should not mutate the original release order", () => {
    const first = {
      ...createRelease("first", true, true),
      score: 50,
    };

    const second = {
      ...createRelease("second", true, true),
      score: 95,
    };

    const releases = [first, second];

    // Save the original order.
    const originalOrder = releases.map((release) => release.id);

    // Rank the candidates.
    const ranked = rankArtworkCandidates(album, releases);

    // Verify that both releases are included.
    expect(ranked).toHaveLength(2);

    // Verify that the original array hasn't changed.
    expect(releases.map((release) => release.id)).toEqual(
      originalOrder
    );

    // Verify that the original array still contains
    // the exact same release objects in the same order.
    expect(releases[0]).toBe(first);
    expect(releases[1]).toBe(second);
  });
});