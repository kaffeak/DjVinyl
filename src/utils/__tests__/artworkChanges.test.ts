import {ArtworkCandidate} from "@/src/utils/artworkSelection";
import {buildArtworkChanges} from "@/src/utils/artworkChanges";

const album = {
  url: "",
  backCoverUrl: "",
};

function createCandidate(kind: ArtworkCandidate["kind"]): ArtworkCandidate {
  return {
    kind,
    release: {
      id: "release-123",
      title: "Killers",
      "artist-credit": [{ name: "Iron Maiden"}],
      media: [{ format: '12" Vinyl' }],
    },
  };
}

const completeArtwork = {
  coverUrl: "https://example.com/new-front.jpg",
  backCoverUrl: "https://example.com/new-back.jpg",
};

describe("ArtworkChanges", () => {
  test("should save both covers when album has no artwork", () => {
    const changes = buildArtworkChanges(
      album,
      createCandidate("pair"),
      completeArtwork
    );

    expect(changes).toEqual({
      url: "https://example.com/new-front.jpg",
      backCoverUrl: "https://example.com/new-back.jpg",
    });
  });

  test("should preserve existing front when selecting back-only artwork", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const changes = buildArtworkChanges(
      existingAlbum,
      createCandidate("back-only"),
      {
        coverUrl: null,
        backCoverUrl: "https://example.com/new-back.jpg",
      }
    );

    expect(changes).toEqual({
      backCoverUrl: "https://example.com/new-back.jpg",
    });

    expect(changes).not.toHaveProperty("url");
  });

  test("should preserve artwork when album already has both covers", () => {
    const completeAlbum = {
      url: "https://example.com/old-front.jpg",
      backCoverUrl: "https://example.com/old-back.jpg",
    };

    const changes = buildArtworkChanges(
      completeAlbum,
      createCandidate("pair"),
      completeArtwork
    );

    expect(changes).toEqual({});
  });

  test("should preserve existing front when pair fetch is incomplete", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const changes = buildArtworkChanges(existingAlbum, createCandidate("pair"), {
      coverUrl: "https://example.com/new-front.jpg",
      backCoverUrl: null,
    });

    expect(changes).toEqual({});
  });

  test("should not save a back cover without a front", () => {
    const changes = buildArtworkChanges(album, createCandidate("back-only"), { coverUrl: "", backCoverUrl: "https://example.com/new-front.jpg"});

    expect(changes).toEqual({});
  });

  test("should replace an existing front when both new covers are available", () => {
    const existingAlbum = {
      ...album,
      url: "https://example.com/old-front.jpg",
    };

    const changes = buildArtworkChanges(existingAlbum, createCandidate("pair"), completeArtwork);

    expect(changes).toEqual({
      url: "https://example.com/new-front.jpg",
      backCoverUrl: "https://example.com/new-back.jpg",
    });
  });

  test("should repair an invalid album", () => {
    const existingAlbum = {
      ...album,
      backCoverUrl: "https://example.com/old-back.jpg",
    };

    const changes = buildArtworkChanges(existingAlbum, null, { coverUrl: "", backCoverUrl: ""});

    expect(changes).toEqual({ backCoverUrl: ""});
  });
});