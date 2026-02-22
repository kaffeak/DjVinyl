import {Pressable, Text, TextInput, View, Image, Modal} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {Databases, Client, ID, Query} from "appwrite";
import {useState, useEffect, useRef} from "react";
import ShuffleButton from "@/app/shuffleButton";
import {Ionicons} from "@expo/vector-icons";
import SettingsModal from "@/app/settingsModal";
import * as Haptics from "expo-haptics";
import LoadingScreen from "@/app/loadingScreen";
import LottieView from "lottie-react-native";
import ShowLibrary from "@/app/library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AlbumCards from "@/app/AlbumCards";
import {GestureHandlerRootView} from "react-native-gesture-handler";

const client = new Client()
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? "")
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? "");

export const db = new Databases(client);
const LAST_LIBRARY_KEY = "lastLibrary";

const shuffleArray = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

export default function Index() {
    const [owner, setOwner] = useState("");
    const [isReady, setIsReady] = useState(false);

    const [albumMenu, setAlbumMenu] = useState(false);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [sides, setSides] = useState<number | null>(null);
    const [genres, setGenres] = useState<string[] | null>(null);
    const [newGenres, setNewGenres] = useState("");

    const [albums, setAlbums] = useState<any[]>([]);
    const [shuffledAlbums, setShuffledAlbums] = useState<any[]>([]);
    const [albumIndex, setAlbumIndex] = useState(0);

    const [currentAlbum, setCurrentAlbum] = useState<{
        title: string;
        artist: string;
        coverUrl: string;
        sideLetter?: string;
    } | null>(null);

    const [library, setLibrary] = useState(false);
    const [settingsMenu, setSettingsMenu] = useState(false);
    const [shuffleMode, setShuffleMode] = useState<"albums" | "sides">("albums");
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [allGenres, setAllGenres] = useState<Record<string, number>>({});
    const [isCoverLoading, setIsCoverLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(LAST_LIBRARY_KEY);
                if (saved === process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_MATS_ID && saved !== null)
                    setOwner(saved);
                else
                    setOwner(process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_ALEX_ID ?? "");
            } catch (err) {
                console.log("Failed to load last library", err);
            } finally {
                setIsReady(true);
            }
        })();
    }, []);

    const toggleGenre = (thisGenre: string) => {
        setSelectedGenres((prev) =>
            prev.includes(thisGenre)
                ? prev.filter((g) => g !== thisGenre)
                : [...prev, thisGenre]
        );
    };

    const buildSidesList = (albums: any[]) => {
        return albums.flatMap((album) =>
            Array.from({ length: album.sides }, (_, i) => ({
                ...album,
                side: i + 1,
                sideLetter: String.fromCharCode(65 + i), // 65 = "A"
            }))
        );
    };

    const fetchAlbumCover = async (album: string, artist: string) => {
        setIsCoverLoading(true);
        if (shuffledAlbums[albumIndex].url !== null) {
            setCurrentAlbum({title: album, artist, coverUrl: shuffledAlbums[albumIndex].url,sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});
            return;
        }
        try {
            const params = new URLSearchParams({
                query: `release:${album} AND artist:${artist}`,
                fmt: "json",
            });
            const mbUrl = `https://musicbrainz.org/ws/2/release/?${params.toString()}`;
            console.log("MusicBrainz release search URL:", mbUrl);

            const mbResponse = await fetch(mbUrl, {
                headers: {
                    "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)",
                    "Accept": "application/json",
                },
            });

            if (!mbResponse.ok) {
                throw new Error(`MusicBrainz request failed: ${mbResponse.status}`);
            }

            const data = await mbResponse.json();

            if (!data.releases?.length) {
                console.log("No release found");
                setCurrentAlbum({
                    title: album,
                    artist,
                    coverUrl: "",
                    sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined,
                });
                return;
            }
            const release = data.releases[0];
            const releaseId: string = release.id;
            const releaseGroupId: string | undefined = release["release-group"]?.id;

            console.log("First release:", release);
            console.log("Using releaseId:", releaseId);
            console.log("Using releaseGroupId:", releaseGroupId);

            const normalizeUrl = (url?: string) =>
              url && url.startsWith("http://")
                ? url.replace("http://", "https://")
                : url;

            const userAgentHeaders = {
                "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)",
                "Accept": "application/json",
            };

            let coverData: any | null = null;

            let coverUrl = `https://coverartarchive.org/release/${releaseId}/`;
            console.log("CoverArt URL (release):", coverUrl);

            let coverResponse = await fetch(coverUrl, { headers: userAgentHeaders });
            console.log("CoverArt status (release):", coverResponse.status, coverResponse.url);

            if (coverResponse.ok) {
                coverData = await coverResponse.json();
            } else if (coverResponse.status === 404 && releaseGroupId) {
                // 4. Fallback: try release-group if release has no art
                const rgUrl = `https://coverartarchive.org/release-group/${releaseGroupId}/`;
                console.log("No art on release, trying release-group URL:", rgUrl);

                coverResponse = await fetch(rgUrl, { headers: userAgentHeaders });
                console.log(
                  "CoverArt status (release-group):",
                  coverResponse.status,
                  coverResponse.url
                );

                if (coverResponse.ok) {
                    coverData = await coverResponse.json();
                } else if (coverResponse.status !== 404) {
                    const body = await coverResponse.text();
                    console.log(
                      "CoverArt error body (release-group, first 200 chars):",
                      body.slice(0, 200)
                    );
                    throw new Error(
                      `CoverArt release-group request failed: ${coverResponse.status}`
                    );
                }
            } else if (!coverResponse.ok) {
                // Some other error (500, etc.)
                const body = await coverResponse.text();
                console.log(
                  "CoverArt error body (release, first 200 chars):",
                  body.slice(0, 200)
                );
                throw new Error(`CoverArt release request failed: ${coverResponse.status}`);
            }

            if (!coverData || !coverData.images?.length) {
                console.log("No cover art images found");
                setCurrentAlbum({
                    title: album,
                    artist,
                    coverUrl: "",
                    sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined,
                });
                return;
            }

            const images: any[] = coverData.images;
            const frontImage = images.find((img) => img.front) ?? images[0];

            const imageUrl =
              normalizeUrl(frontImage.thumbnails?.["500"]) ||
              normalizeUrl(frontImage.thumbnails?.["1200"]) ||
              normalizeUrl(frontImage.image);

            console.log("Using cover art URL:", imageUrl);
            setAlbums(prev => {
                let idToUpdate: string | null = null;
                const updated = prev.map(item=> {
                    if( item.title === album && item.artist === artist){
                        idToUpdate = item.$id;
                        return { ...item, url: imageUrl };
                    }
                    return item;
                });
                if(idToUpdate !== null){
                    updateDb(idToUpdate, imageUrl).catch(err => console.error("Failed to update DB:", err));
                }
                return updated;
            })


            setCurrentAlbum({
                title: album,
                artist,
                coverUrl: imageUrl ?? "",
                sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined,
            });
        } catch (err) {
            console.error("Error fetching album cover:", err);
            setCurrentAlbum({
                title: album,
                artist,
                coverUrl: "",
                sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined,
            });
        } finally {
            setIsCoverLoading(false);
        }
    };

    useEffect(() => {
        db.listDocuments(process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? "", owner ?? "", [Query.limit(200)])
            .then((response) => {
                const docs = response.documents;
                setAlbums(docs);
                setShuffledAlbums(shuffleArray(docs));
                setAlbumIndex(0);
            })
            .catch((error) => console.error(error));
    }, [owner]);

    useEffect(() => {
        reshuffleAlbums();
        const genreCount: Record<string, number> = {};
        albums.forEach((album) => {
            if (Array.isArray(album.genres)) {
                album.genres.forEach((g: string) => {
                    genreCount[g] = (genreCount[g] || 0) + 1;
                });
            } else if (typeof album.genres === "string"){
                genreCount[album.genres] = (genreCount[album.genres] || 0) + 1;
            }
        })
        setAllGenres(genreCount)
    }, [albums]);

    useEffect(() => {
        if (shuffledAlbums.length > 0 && albumIndex < shuffledAlbums.length) {
            const album = shuffledAlbums[albumIndex];
            if (album?.title && album?.artist) {
                fetchAlbumCover(album.title, album.artist);
            } else {
                console.warn("Invalid album data at index", albumIndex);
            }
        }
    }, [albumIndex, shuffledAlbums]);

    const shuffleAlbums = () => {
        if (albumIndex + 1 < shuffledAlbums.length) {
            setAlbumIndex(albumIndex + 1);
        } else {
            reshuffleAlbums(); // when you reach the end, reshuffle again
        }
    };

    const reshuffleAlbums = () => {
        let pool = albums;

        if (selectedGenres.length > 0) {
            pool = albums.filter(
                (a) => Array.isArray(a.genres) && a.genres.some((g: string) => selectedGenres.includes(g))
            );
        }

        if (shuffleMode === "sides") {
            pool = buildSidesList(pool);
        }

        const newShuffle = shuffleArray(pool);
        setShuffledAlbums(newShuffle);
        setAlbumIndex(0);
        //console.log(JSON.stringify(shuffledAlbums, null, 2));
    };

    const sendToDb = async (genreList: string[]) => {
        const newId = ID.unique();
        try {
            const response = await db.createDocument(
              process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? "",
              owner ?? "",
              newId,
              {
                  title,
                  sides,
                  artist,
                  genres: genreList,
              }
            );
            console.log("Created doc:", response);
            return response;
        } catch (error) {
            console.error("Error creating document: ", error);
            throw error;
        }
    }

    const updateDb = async (id: string, newUrl?: string, newGenres?: string[]): Promise<void> => {
        const data: {
            url?: string;
            genres?: string[];
        } = {};

        if(typeof newUrl !== "undefined") {
            data.url = newUrl;
        }
        if(typeof newGenres !== "undefined") {
            data.genres = newGenres;
        }
        if(Object.keys(data).length === 0) {
            console.log("updateDb called with no changes; skipping update.");
            return;
        }
        try {
            await db.updateDocument(
              process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
              owner!,
              id,
              data
            )
        } catch (err) {
            console.error("updateDb error:", err);
            throw err;
        }

    }

    const handleUpdateGenres = async (albumTitle: string, albumArtist: string, newGenres: string[]) => {
        setAlbums(prev => {
            let idToUpdate: string | null = null;
            const updated = prev.map(item => {
                if (item.title === albumTitle && item.artist === albumArtist) {
                    idToUpdate = item.$id;
                    return {...item, genres: newGenres};
                }
                return item;
            });
            if (idToUpdate !== null) {
                try {
                    updateDb(idToUpdate, undefined, newGenres);
                } catch (err) {
                    console.error("Failed to update genres in DB", err);
                }
            }
            return updated;
        })
    }

    const addAlbum = async () => {
        const genreList = newGenres.toLowerCase().split(",");
        const response = await sendToDb(genreList);
        setAlbums(prev => [...prev, response]);
        console.log("Adding album:", {title, artist, sides, genreList});
        setTitle("");
        setArtist("");
        setSides(null);
        setNewGenres("");
    };

    const removeAlbum = async (albumToRemove: {
        title: string;
        artist: string;
        url: string;
        sides: number;
        genres: string[],
        sideLetter?: string;
    }) => {
        let idToRemove: string | null = null;
        setAlbums(prev => {
            const updated = prev.filter(item => {
                const match = item.title === albumToRemove.title && item.artist === albumToRemove.artist
                if(match) {
                    idToRemove = item.$id;
                    return false;
                }
                return true;
            });
            return updated;
        })
        if (idToRemove !== null) {
            try {
                await db.deleteDocument(
                  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
                  owner!,
                  idToRemove
                )
            } catch (err){
                console.log("Error when trying to remove album, ", err)
            }
        }
    }

    const handleSetSides = (input: string) => {
        const parsed = parseInt(input, 10);
        setSides(isNaN(parsed) ? null : parsed);
    }

    const changeLibrary = () => {
        const newLib = owner === process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_ALEX_ID ? process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_MATS_ID : process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_ALEX_ID;
        if(newLib){
            setOwner(newLib);
            AsyncStorage.setItem(LAST_LIBRARY_KEY, newLib).catch(err =>
                console.log("Failed to save last library", err));
        }
    }

    if(!isReady) {
        return (
          <LottieView
            source={require("../assets/images/turntable.json")}
            autoPlay
            loop
            style={{width: 180, height: 180, position: "absolute"}}
          />
        );
    }

    if (albums.length === 0) {
        return <LoadingScreen />;
    }
  return (
<GestureHandlerRootView>
  <LinearGradient
          colors={["#1e293b", "#0f172a"]} // slate/dark blue
          start={[0, 0]}
          end={[0, 1]}
          style={{ flex: 1 }}
      >
    <View className="flex-1 ">
        <View className="flex-row justify-between p-4 mt-6">
            <Pressable
              onPress={() => {
                  Haptics.selectionAsync();
                  setLibrary(true);
              }}
            >
                <Ionicons name="library-outline" size={28} color="white"/>
            </Pressable>
            <View className="flex-1 items-center mt-5">
                <Pressable
                  onPress={() => {
                      Haptics.selectionAsync();
                      changeLibrary();
                  }}>
                    <Text className="mt-4 font-bold text-3xl text-gray-200 text-center">{owner === process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_ALEX_ID ? "Alex" : "Mats and Sylvias"} collection</Text>
                </Pressable>
            </View>
            <Pressable
                onPress={() => {
                    Haptics.selectionAsync();
                    setSettingsMenu(true);
                }}
            >
                <Ionicons name="settings-outline" size={28} color="white"/>
            </Pressable>
        </View>
        {/*Here starts the ablum content*/}
        <View className="flex-1 items-center justify-center">
            <AlbumCards albums={shuffledAlbums} reShuffleAlbums={reshuffleAlbums}/>
        </View>

        {/*<View className="flex-1 items-center justify-center">
            <View style={{
                width: 250,
                height: 250,
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
            }}>
                {isCoverLoading ? (
                  <LottieView
                    source={require("../assets/images/turntable.json")}
                    autoPlay
                    loop
                    style={{width: 180, height: 180, position: "absolute"}}
                  />
                ) : null}
                <Image
                  source={{
                      uri: currentAlbum?.coverUrl ? currentAlbum.coverUrl : "https://placehold.co/250x250?text=No+Cover",
                      width: 250,
                      height: 250
                  }}
                  style={{
                      resizeMode: "contain",
                      borderRadius: 16,
                      position: "absolute",
                      opacity: isCoverLoading ? 0 : 1
                  }}
                  onLoadStart={() => setIsCoverLoading(true)}
                  onLoadEnd={() => setIsCoverLoading(false)}
                />
            </View>
            <Text className="mt-4 font-bold text-lg text-gray-200 text-center">
                {currentAlbum ? `${currentAlbum.title} — ${currentAlbum.artist} ${currentAlbum.sideLetter ? ` (Side ${currentAlbum.sideLetter})` : ""}` : "No album selected"}
            </Text>
            <View className="mt-6">
                <ShuffleButton callParentFunction={shuffleAlbums}/>
            </View>
        </View>*/}

        <View className="items-center mb-16">
            <Pressable
                onPress={() => {
                    Haptics.selectionAsync();
                    setAlbumMenu(true);
                }}
                style={{
                    borderRadius: 999, // pill shape
                    overflow: 'hidden', // needed for gradient corners
                    elevation: 5, // shadow for Android
                }}
            >
                <LinearGradient
                    colors={['#8B5CF6', '#EC4899']} // purple to pink
                    start={[0, 0]}
                    end={[1, 0]}
                    style={{
                        paddingVertical: 14,
                        paddingHorizontal: 30,
                        alignItems: 'center',
                        borderRadius: 999,
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>
                        ＋ Add Album
                    </Text>
                </LinearGradient>
            </Pressable>
        </View>

        <Modal visible={albumMenu} transparent animationType="slide">
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="bg-white rounded-2xl p-6 w-80 shadow-lg">
                    <Text className="text-2xl font-bold mb-6 text-center text-gray-800">Add New Album</Text>

                    <TextInput
                        autoFocus={true}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Title"
                        placeholderTextColor="#9CA3AF"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                        value={artist}
                        onChangeText={setArtist}
                        placeholder="Artist"
                        placeholderTextColor="#9CA3AF"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                        value={sides !== null ? sides.toString() : ""}
                        onChangeText={handleSetSides}
                        placeholder="Number of Sides"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                      value={newGenres}
                      onChangeText={setNewGenres}
                      placeholder="Genres (separated by , )"
                      placeholderTextColor="#9CA3AF"
                      className="border border-gray-300 rounded-lg p-3 mb-3"
                    />

                    <View className="flex-row justify-around">
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                addAlbum();
                            }}
                            className="bg-blue-500 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-white font-semibold">Add</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                setAlbumMenu(false)
                            }}
                            className="bg-gray-300 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-gray-800 font-semibold">Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
        <SettingsModal
            visible={settingsMenu}
            onClose={() => {
                setSettingsMenu(false);
                reshuffleAlbums();
            }}
            shuffleMode={shuffleMode}
            setShuffleMode={setShuffleMode}
            selectedGenres={selectedGenres}
            toggleGenre={toggleGenre}
            allGenres={allGenres}
        />
        <ShowLibrary
          visible={library}
          albums={shuffledAlbums}
          onUpdateAlbumGenres={handleUpdateGenres}
          onRemoveAlbumL={removeAlbum}
          onClose={() => {setLibrary(false)}}
        />
    </View>
  </LinearGradient>
</GestureHandlerRootView>
  )
}
