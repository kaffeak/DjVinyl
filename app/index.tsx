import {Pressable, Text, TextInput, View, Image} from "react-native";
import {Databases, Client, ID, Query} from "appwrite";
import {useState, useEffect} from "react";
import ShuffleButton from "@/app/shuffleButton";
import {sleep} from "@/services/utils";

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
    const [delay, setDelay] = useState(0);

    var firstShuffle = true;

    const tempURL = " https://upload.wikimedia.org/wikipedia/en/8/8d/Starset_-_Horizons.png";

    useEffect(() => {
        if (currentAlbum) {
            setAlbumImage()
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
            '68ada605003cab076573',
            [
                Query.select("title"),
                Query.select("artist")
            ]
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

    const setAlbumImage = async () => {
        await sleep(delay);
        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.EXPO_PUBLIC_GOOGLE_API_KEY}&cx=${process.env.EXPO_PUBLIC_GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(currentAlbum + " album cover")}&searchType=image`;

        const response = await fetch(url);
        const data = await response.json();

        if(data.searchInformation.totalResults > 0) {
            const imageUrl = data.items[0].link
            setCurrentURL(imageUrl)
            if(delay > 0)
                setDelay(delay-5);
        console.log("Fetched Image URL: ", currentURL);
        }else {
            setDelay(delay+10);
            setAlbumImage();
        }
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
                                source={{ uri: currentURL }}
                                className="w-3/4 aspect-square"
                            />
                        ) : (
                            <Text>Loading image...</Text>
                        )}
                    </View>
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
