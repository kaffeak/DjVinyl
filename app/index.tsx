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

export default function Index() {
    const [albumMenu, setalbumMenu] = useState(false);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [sides, setSides] = useState<number | null>(null);
    const [genre, setGenre] = useState("");
    const [currentAlbum, setCurrentAlbum] = useState("");
    const [currentArtist, setCurrentArtist] = useState("");
    const [currentURL, setCurrentURL] = useState("https://thumbs.dreamstime.com/z/colorful-abstract-welcome-design-posters-banners-perfect-featuring-vibrant-patterns-playful-shapes-to-create-cheerful-341184955.jpg");

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

            if (!data.releases || data.releases.length === 0) {
                console.log("No release found");
                return null;
            }
            console.log("Title: " + currentAlbum + ", Artist: " + currentArtist);

            const coverResponse = await fetch(`https://coverartarchive.org/release/${data.releases[0].id}`);
            const coverData = await coverResponse.json();

            if (!coverData.images[0].image) {
                console.log("No cover art found");
                return null;
            }
            //implement dubble image if there is a back
            if (!coverData.images[0].thumbnails.small) {
                setCurrentURL(coverData.images[0].image);
                return null;
            }
            setCurrentURL(coverData.images[0].thumbnails.small);

        } catch (err) {
            console.error("Error fetching album cover:", err);
        }
    }

    const tempURL = " https://upload.wikimedia.org/wikipedia/en/8/8d/Starset_-_Horizons.png";


    useEffect(() => {
        if (currentAlbum) {
            fetchAlbumCover(currentAlbum, currentArtist);
        }
    }, [currentAlbum]);

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

    const shuffleAlbums = () => {
        let promise = db.listDocuments(
            '68ada3e1001da2d5fb66',
            '68ada605003cab076573'
        )


        promise.then(function (response) {
            console.log(response);
            let randNumber = Math.floor(Math.random() * response.documents.length);
            setCurrentAlbum(response.documents[randNumber].title);
            setCurrentArtist(response.documents[randNumber].artist);
        }, function (error) {
            console.log(error);
        });
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
                    <View className="flex-1 items-center justify-center bg-white">
                        {currentURL !== "" ? (
                            <Image
                                source={{ uri: currentURL, width: 250, height: 250}}

                            />
                        ) : (
                            <Text>Loading image...</Text>
                        )}
                    </View>
                    <ShuffleButton callParentFunction={shuffleAlbums} />
                    <Pressable
                        onPress={() => {fetchAlbumCover("Horizon inn", "Fricky")}}
                        className="bg-green-500 px-4 py-2 rounded-lg mt-20"
                    >
                        <Text>Test API</Text>
                    </Pressable>
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
