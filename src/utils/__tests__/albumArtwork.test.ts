import {getDisplayedCoverUrl} from "@/src/utils/albumArtwork";

describe("getDisplayedCoverUrl", () => {
  const album = {
    url: "https://example.com/front.jpg",
    backCoverUrl: "https://example.com/back.jpg",
  };

  test("should display the front cover normally", async () => {
    expect(getDisplayedCoverUrl(album, false)).toBe("https://example.com/front.jpg");
  });

  test("should display the back cover when viewing tracks", async () => {
    expect(getDisplayedCoverUrl(album, true)).toBe("https://example.com/back.jpg");
  });

  test("should fall back to the front cover when no back cover exists", async () => {
    expect(getDisplayedCoverUrl({ ...album, backCoverUrl: ""}, true)).toBe("https://example.com/front.jpg");
  });

  test("should ignore whitespace-only back-cover URLs", async () => {
    expect(getDisplayedCoverUrl({ ...album, backCoverUrl: "    "}, true)).toBe("https://example.com/front.jpg");
  });
})