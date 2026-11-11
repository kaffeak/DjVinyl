import { selectBestRelease } from "../releaseMatching";
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
});