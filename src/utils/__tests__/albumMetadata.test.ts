import {Album} from "@/src/types/album";
import {getMetadataNeeds} from "@/src/utils/albumMetadata";

describe("getMetadataNeeds", () => {
  const album: Album = {
    $id: "test-1",
    title: "Test",
    artist: "Test Artist",
    url: "",
    sides: 2,
    genres: [],
    trackList: [],
  };

  test("should detect when both cover and tracks are missing", () => {
    const result = getMetadataNeeds(album);

    expect(result).toEqual({
      needsCover: true,
      needsTracks: true,
    });
  });

  test("should detect that neither artwork or tracks needs fetching", () => {
    const albumWithEverything = {
      ...album,
      url: "https://example.com/cover.jpg",
      trackList: ["track1 - 4:32"],
    };

    const result = getMetadataNeeds(albumWithEverything);

    expect(result).toEqual({
      needsCover: false,
      needsTracks: false
    });
  });

  test("should detect that tracks are missing", () => {
    const albumWithUrl = {
      ...album,
      url: "https://example.com/cover.jpg",
    };

    const result = getMetadataNeeds(albumWithUrl);

    expect(result).toEqual({
      needsCover: false,
      needsTracks: true,
    });
  });

  test("should detect that track duration is malformed", () => {
    const albumWithBrokenTracks = {
      ...album,
      url: "https://example.com/cover.jpg",
      trackList: ["track1 - 4:323"],
    };

    const result = getMetadataNeeds(albumWithBrokenTracks);

    expect(result).toEqual({
      needsCover: false,
      needsTracks: true,
    });
  });
})