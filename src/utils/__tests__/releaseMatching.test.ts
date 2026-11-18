import {hasSingleTitleTypo, selectBestRelease} from "../releaseMatching";
import type { MusicBrainzRelease } from "@/src/types/musicBrainz";

function createRelease(
  id: string,
  overrides: Partial<MusicBrainzRelease> = {}
): MusicBrainzRelease {
  return {
    id,
    title: "The Last in Line",
    "artist-credit": [{ name: "Dio"}],
    status: "Official",
    "release-group": {
      id: "group-123",
      "primary-type": "Album",
    },
    ...overrides,
  };
}

describe("selectBestRelease", () => {
  test("should prefer vinyl over CD for the same album", async () => {
    const cdRelease = createRelease("cd-123", {
      media: [{ format: "CD"}],
    });

    const vinylRelease = createRelease("vinyl-123", {
      media: [{ format: "12\" Vinyl"  }],
    });

    const result = selectBestRelease([cdRelease, vinylRelease], "The Last in Line", "Dio");

    expect(result?.id).toBe("vinyl-123");
  });

  test("should prioritize the correct artist over format", () => {
    const wrongArtist = createRelease("wrong-artist", {
      "artist-credit": [{ name: "Another Artist" }],
      media: [{ format: "Vinyl"}],
      score: 100,
    });

    const correctArtist = createRelease("correct-artist", {
      media: [{ format: "CD"}],
      score: 85,
    });

    const result = selectBestRelease([wrongArtist, correctArtist], "The Artist", "Dio");

    expect(result?.id).toBe("correct-artist");
  });

  test("should return null when no releases are found", async () => {
    const result = selectBestRelease([], "Unknown Album", "Unknown Artist");

    expect(result).toBeNull();
  });

  test("should use MusicBrainz relevance scores when releases are otherwise equal", async () => {
    const lowerScore = createRelease("lower-score", {
      media: [{ format: "Vinyl"}],
      score: "65",
    });

    const higherScore = createRelease("higher-score", {
      media: [{ format: "Vinyl"}],
      score: "95",
    });

    const result = selectBestRelease([lowerScore, higherScore], "The Last in Line", "Dio");

    expect(result?.id).toBe("higher-score");
  });

  test("should prefer 12-inch vinyl over generic vinyl", async () => {
    const genericVinyl = createRelease("generic-vinyl", {
      media: [{ format: "Vinyl"}],
    });

    const twelveVinyl = createRelease("12-inch-vinyl", {
      media: [{ format: '12" Vinyl'}],
    });

    const result = selectBestRelease([genericVinyl, twelveVinyl], "The Last in Line", "Dio");

    expect(result?.id).toBe("12-inch-vinyl");
  });

  test("should prefer a vinyl release with front and back artwork", async () => {
    const noArtwork = createRelease("no-artwork", {
      media: [{ format: "Vinyl"}],
      "cover-art-archive": {
        artwork: false,
        front: false,
        back: false,
        count: 0,
      },
    });

    const completeArtwork = createRelease("complete-artwork", {
      media: [{ format: "Vinyl"}],
      "cover-art-archive": {
        artwork: true,
        front: true,
        back: true,
        count: 4,
      },
    });

    const result = selectBestRelease([noArtwork, completeArtwork], "The Last in Line", "Dio");

    expect(result?.id).toBe("complete-artwork");
  });

  describe("hasSingleTitleTypo", () => {
    test("should accept a single character insertion", () => {
      expect(
        hasSingleTitleTypo(
          "CARLIFORNIA GIRLS",
          "California Girls"
        )
      ).toBe(true);
    });

    test("should accept a single character substitution", () => {
      expect(
        hasSingleTitleTypo(
          "Californix Girls",
          "California Girls"
        )
      ).toBe(true);
    });

    test("should reject identical titles", () => {
      expect(
        hasSingleTitleTypo(
          "California Girls",
          "California Girls"
        )
      ).toBe(false);
    });

    test("should reject unrelated album titles", () => {
      expect(
        hasSingleTitleTypo(
          "Take the Heat Off Me",
          "Daddy Cool"
        )
      ).toBe(false);
    });

    test("should reject titles with different word counts", () => {
      expect(
        hasSingleTitleTypo(
          "The Dream",
          "The Dream Deluxe"
        )
      ).toBe(false);
    });

    test("should reject titles with multiple spelling mistakes", () => {
      expect(
        hasSingleTitleTypo(
          "Carlifornia Girrls",
          "California Girls"
        )
      ).toBe(false);
    });

    test("should reject changes to album numbers", () => {
      expect(
        hasSingleTitleTypo(
          "Album 17",
          "Album 18"
        )
      ).toBe(false);
    });

    test("should reject changes to short words", () => {
      expect(
        hasSingleTitleTypo(
          "California Girls",
          "California Gills"
        )
      ).toBe(false);
    });

    test("should reject two-character transpositions", () => {
      expect(
        hasSingleTitleTypo(
          "Californai Girls",
          "California Girls"
        )
      ).toBe(false);
    });

    test("should ignore capitalization and punctuation", () => {
      expect(
        hasSingleTitleTypo(
          "CALIFORNIA-GIRLS",
          "California Girls"
        )
      ).toBe(false);
    });
  });

});