import {Pressable, Text, TextInput, View, Image, Modal} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {Databases, Client, ID, Query} from "appwrite";
import {useState, useEffect} from "react";
import ShuffleButton from "@/app/shuffleButton";
import {Ionicons} from "@expo/vector-icons";
import SettingsModal from "@/app/settingsModal";
import * as Haptics from "expo-haptics";

const client = new Client()
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? "")
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? "");

export const db = new Databases(client);


//database id: 68ada3e1001da2d5fb66
//collection id: 68ada605003cab076573

const shuffleArray = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

export default function Index() {
    const [albumMenu, setAlbumMenu] = useState(false);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [sides, setSides] = useState<number | null>(null);
    const [genre, setGenre] = useState("");

    const [albums, setAlbums] = useState<any[]>([]);
    const [shuffledAlbums, setShuffledAlbums] = useState<any[]>([]);
    const [albumIndex, setAlbumIndex] = useState(0);

    const [currentAlbum, setCurrentAlbum] = useState<{
        title: string;
        artist: string;
        coverUrl: string;
        sideLetter?: string;
    } | null>(null);

    const [settingsMenu, setSettingsMenu] = useState(false);
    const [shuffleMode, setShuffleMode] = useState<"albums" | "sides">("albums");
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [allGenres, setAllGenres] = useState<string[]>([]);

    const toggleGenre = (genre: string) => {
        setSelectedGenres((prev) =>
            prev.includes(genre)
                ? prev.filter((g) => g !== genre)
                : [...prev, genre]
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
        if (shuffledAlbums[albumIndex].url !== null) {
            setCurrentAlbum({title: album, artist, coverUrl: shuffledAlbums[albumIndex].url,sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});
            return;
        }
        try {
            const query = `release/?query=release:${encodeURIComponent(album)} AND artist:${encodeURIComponent(artist)}&fmt=json`;
            const mbUrl = `https://musicbrainz.org/ws/2/${query}`;
            const response = await fetch(mbUrl, {
                headers: {
                    "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)"
                }
            });

            if (!response.ok) {
                throw new Error(`MusicBrainz request failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.releases?.length) {
                console.log("No release found");
                setCurrentAlbum({ title: album, artist, coverUrl: "" , sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});
                return;
            }
            console.log("Title: " + currentAlbum?.title + ", Artist: " + currentAlbum?.artist);

            const releaseId = data.releases[0].id;
            const coverResponse = await fetch(`https://coverartarchive.org/release/${releaseId}`, {});

            if (!coverResponse.ok) {
                throw new Error(`CoverArt request failed: ${coverResponse.status}`);
            }

            const coverData = await coverResponse.json();

            if (!coverData.images?.length) {
                console.log("No cover art found");
                setCurrentAlbum({ title: album, artist, coverUrl: "" , sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});
                return;
            }
            //implement dubble image if there is a back
            const imageUrl =
                coverData.images[0].thumbnails?.["1200"] ||
                coverData.images[0].thumbnails?.["500"] ||
                coverData.images[0].image;

            setCurrentAlbum({title: album, artist, coverUrl: imageUrl, sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});

        } catch (err) {
            console.error("Error fetching album cover:", err);
            setCurrentAlbum({ title: album, artist, coverUrl: "" , sideLetter: shuffleMode === "sides" ? shuffledAlbums[albumIndex].sideLetter : undefined});
        }
    }

    //fetch once on mount
    useEffect(() => {
        db.listDocuments("68ada3e1001da2d5fb66", "68ada605003cab076573", [Query.limit(200)])
            .then((response) => {
                const docs = response.documents;
                setAlbums(docs);
                setShuffledAlbums(shuffleArray(docs));
                setAlbumIndex(0);
                console.log(docs.length);

                const genreSet = new Set<string>();
                docs.forEach((album) => {
                    if (Array.isArray(album.genres)) {
                        album.genres.forEach((g: string) => genreSet.add(g));
                    } else if (typeof album.genres === "string")
                        genreSet.add(album.genres);
                })
                setAllGenres(Array.from(genreSet))
                //console.log(JSON.stringify(response.documents, null, 2));
            })
            .catch((error) => console.error(error));
    }, []);

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
        console.log(JSON.stringify(shuffledAlbums, null, 2));
    };

    const sendToDb = () => {
        const promise = db.createDocument(
            '68ada3e1001da2d5fb66',
            '68ada605003cab076573',
            ID.unique(),
            {
                title,
                sides,
                genres: genre.split(",").map(g => g.toString()),
                artist
            }
        );

        promise.then(function (response) {
            console.log(response);
        }, function (error) {
            console.log(error);
        });
    }


    const addAlbum = () => {
        sendToDb();
        console.log("Adding album:", {title, artist, sides, genre});
        setTitle("");
        setArtist("");
        setSides(null);
        setGenre("");
    };

    const handleSetSides = (input: string) => {
        const parsed = parseInt(input, 10);
        setSides(isNaN(parsed) ? null : parsed);
    }

  return (
  <LinearGradient
          colors={["#1e293b", "#0f172a"]} // slate/dark blue
          start={[0, 0]}
          end={[0, 1]}
          style={{ flex: 1 }}
      >
    <View className="flex-1 ">
        <View className="flex-row justify-end p-4 mt-6">
            <Pressable
                onPress={() => {
                    Haptics.selectionAsync();
                    setSettingsMenu(true);
                }}
            >
                <Ionicons name="settings-outline" size={28} color="white"/>
            </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
            <Image
                source={{ uri: currentAlbum?.coverUrl ? currentAlbum.coverUrl : "https://placehold.co/250x250?text=No+Cover", width: 250, height: 250}}
                style={{resizeMode: "contain", borderRadius: 16}}

            />
            <Text className="mt-4 font-bold text-lg text-gray-200 text-center">
                {currentAlbum ? `${currentAlbum.title} — ${currentAlbum.artist} ${currentAlbum.sideLetter ? ` (Side ${currentAlbum.sideLetter})` : ""}` : "No album selected"}
            </Text>
            <View className="mt-6">
                <ShuffleButton callParentFunction={shuffleAlbums} />
            </View>
        </View>

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
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Title"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                        value={artist}
                        onChangeText={setArtist}
                        placeholder="Artist"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                        value={sides !== null ? sides.toString() : ""}
                        onChangeText={handleSetSides}
                        placeholder="Number of Sides"
                        keyboardType="numeric"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TextInput
                        value={genre}
                        onChangeText={setGenre}
                        placeholder="Genres separated by ,"
                        className="border border-gray-300 rounded-lg p-3 mb-6"
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
    </View>
  </LinearGradient>
  )
}
