import {Pressable, Text, TextInput, View, Image} from "react-native";
import {Databases, Client, ID, Query} from "appwrite";
import {useState, useEffect} from "react";
import ShuffleButton from "@/app/shuffleButton";

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
    const [albumMenu, setalbumMenu] = useState(false);
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
    } | null>(null);

    const fetchAlbumCover = async (album: string, artist: string) => {
        try {
            const query = `release/?query=release:${encodeURIComponent(album)} AND artist:${encodeURIComponent(artist)}&fmt=json`;
            const mbUrl = `https://musicbrainz.org/ws/2/${query}`;
            const response = await fetch(mbUrl, {
                headers: {
                    "User-Agent": "DjVinyl/1.0.0 (kaffe.ak46@gmail.com)"
                }
            });
            const data = await response.json();

            if (!data.releases?.length) {
                console.log("No release found");
                setCurrentAlbum({ title, artist, coverUrl: "" });
                return;
            }
            console.log("Title: " + currentAlbum?.title + ", Artist: " + currentAlbum?.artist);

            const releaseId = data.releases[0].id;
            const coverResponse = await fetch(`https://coverartarchive.org/release/${releaseId}`, {});
            const coverData = await coverResponse.json();

            if (!coverData.images?.length) {
                console.log("No cover art found");
                setCurrentAlbum({ title, artist, coverUrl: "" });
                return;
            }
            //implement dubble image if there is a back
            const imageUrl =
                coverData.images[0].thumbnails?.["250"];
                coverData.images[0].thumbnails?.small ||
                coverData.images[0].thumbnails?.large ||
                coverData.images[0].image;

            setCurrentAlbum({title: album, artist, coverUrl: imageUrl});

        } catch (err) {
            console.error("Error fetching album cover:", err);
            setCurrentAlbum({ title, artist, coverUrl: "" });
        }
    }

    //fetch once on mount
    useEffect(() => {
        db.listDocuments("68ada3e1001da2d5fb66", "68ada605003cab076573")
            .then((response) => {
                setAlbums(response.documents);
                setShuffledAlbums(shuffleArray(response.documents));
                setAlbumIndex(0);
            })
            .catch((error) => console.error(error));
    }, []);

    useEffect(() => {
        if (shuffledAlbums.length > 0 && albumIndex < shuffledAlbums.length) {
            const album = shuffledAlbums[albumIndex];
            fetchAlbumCover(album.title, album.artist);
        }
    }, [albumIndex, shuffledAlbums]);

    const shuffleAlbums = () => {
        if (albumIndex + 1 < shuffledAlbums.length) {
            setAlbumIndex(albumIndex + 1);
        } else {
            setShuffledAlbums(shuffleArray(albums));
            setAlbumIndex(0);
        }
    }

    const sendToDb = () => {
        const promise = db.createDocument(
            '68ada3e1001da2d5fb66',
            '68ada605003cab076573',
            ID.unique(),
            {
                title,
                sides,
                genre,
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
        setalbumMenu(false);
    }

    const handleSetSides = (input: string) => {
        const parsed = parseInt(input, 10);
        setSides(isNaN(parsed) ? null : parsed);
    }

  return (
    <View className="flex-1 relative bg-white">
        {!albumMenu && (
            <View>
                <View className="items-end mr-5 mt-10">
                    <Pressable
                        className="border-black border-2 rounded-md bg-black/20"
                        onPress={() => {setalbumMenu(true);}}
                    >
                        <Text className="font-semibold text-xl m-1">
                            Add Album!
                        </Text>
                    </Pressable>
                </View>
                <View className="items-center mt-5">
                    <Image
                        source={{ uri: currentAlbum?.coverUrl ? currentAlbum.coverUrl : "https://via.placeholder.com/300?text=No+Cover", width: 250, height: 250}}
                        style={{resizeMode: "contain"}}
                    />
                    <Text className="mt-2 font-semibold">
                        {currentAlbum ? `${currentAlbum.title} — ${currentAlbum.artist}` : "No album selected"}
                    </Text>
                    <ShuffleButton callParentFunction={shuffleAlbums} />
                </View>
            </View>
        )}
        {albumMenu && (
            <View className="flex-1 items-center justify-center px-6">
                <Text className="text-3xl font-bold m-1">Title</Text>
                <TextInput
                    className="border-2 border-black rounded-2xl bg-black/20 m-1"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter title"
                />
                <Text className="text-3xl font-bold m-1">Artist</Text>
                <TextInput
                    className="border-2 border-black rounded-2xl bg-black/20 m-1"
                    value={artist}
                    onChangeText={setArtist}
                    placeholder="Enter artist"
                />
                <Text className="text-3xl font-bold m-1">Number of Sides</Text>
                <TextInput
                    className="border-2 border-black rounded-2xl bg-black/20 m-1"
                    value={sides !== null ? sides.toString() : ""}
                    keyboardType={"numeric"}
                    onChangeText={handleSetSides}
                    placeholder="Enter number"
                />
                <Text className="text-3xl font-bold m-1">Genre</Text>
                <TextInput
                    className="border-2 border-black rounded-2xl bg-black/20 m-1"
                    value={genre}
                    onChangeText={setGenre}
                    placeholder="Enter genre"
                />
                <Pressable
                    className="border-black border-2 rounded-md mt-5 bg-black/20 m-1"
                    onPress={() => {addAlbum()}}
                >
                    <Text className="font-semibold text-xl m-1">
                        Add
                    </Text>
                </Pressable>
                <Pressable
                    className="border-black border-2 rounded-md mt-5 bg-black/20"
                    onPress={() => {setalbumMenu(false)}}
                >
                    <Text className="font-semibold text-xl m-1">
                        Return
                    </Text>
                </Pressable>
            </View>
        )}
    </View>
  );
}
