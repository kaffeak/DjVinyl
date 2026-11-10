import {buildSidesList, shuffleArray} from "@/src/utils/albums";
import {Album} from "@/src/types/album";

describe("shuffleArray", () => {
  test("should return an empty array when given an empty array", () => {
    const result = shuffleArray([]);

    expect(result).toEqual([]);
  });

  test("should preserve all elements", () => {
    const original = [1, 2, 3, 4, 5];

    const shuffled = shuffleArray(original);

    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort()).toEqual([...original].sort());
  });

  test("should not modify the original array", () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];

    const shuffled = shuffleArray(original);

    expect(original).toEqual(originalCopy);
    expect(shuffled).not.toBe(original);
  });

  test("should produce a predictable shuffle with mocked randomness", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);

    try {
      const result = shuffleArray([1, 2, 3]);

      expect(result).toEqual([2, 3, 1]);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

describe("buildSIdesList", () => {
  const createAlbum = (
    id: string,
    sides: number
  ): Album => ({
    $id: id,
    title: "Test Album",
    artist: "Test Artist",
    url: "",
    sides,
    genres: ["rock"],
    trackList: [],
  });

  test("should create one entry for each record side", () => {
    const albums = [
      createAlbum("album-1", 2),
      createAlbum("album-2", 1),
    ];

    const result = buildSidesList(albums);

    expect(result).toHaveLength(3);
    expect(result.map((album) => album.sideLetter)).toEqual(["A", "B", "A"]);
  });

  test("should preserve the original album IDs", () => {
    const albums = [createAlbum("album-1", 2)];

    const result = buildSidesList(albums);

    expect(result[0].$id).toBe("album-1");
    expect(result[1].$id).toBe("album-1");
  });

  test("should not modify the original albums", () => {
    const albums = [createAlbum("album-1", 2)];

    buildSidesList(albums);

    expect(albums[0].sideLetter).toBeUndefined();
    expect(albums).toHaveLength(1);
  })
})