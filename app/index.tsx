import {Pressable, Text, View} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {useState, useEffect, useRef} from "react";
import {Ionicons} from "@expo/vector-icons";
import SettingsModal from "@/src/components/settingsModal";
import * as Haptics from "expo-haptics";
import LoadingScreen from "@/src/components/loadingScreen";
import LottieView from "lottie-react-native";
import ShowLibrary from "@/src/components/library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AlbumCards from "@/src/components/AlbumCards";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import type {Album} from "@/src/types/album";
import {buildSidesList, shuffleArray} from "@/src/utils/albums";
import AddAlbumModal from "@/src/components/AddAlbumModal";
import { useAlbumLibrary} from "@/src/hooks/useAlbumLibrary";

const LAST_LIBRARY_KEY = "lastLibrary";
const LAST_QUEUE = "lastQueue";

export default function Index() {
  const [owner, setOwner] = useState("");

  const {
    albums,
    allGenres,
    isLoading,
    loadError,
    loadedLibraryId,
    addAlbum,
    removeAlbum,
    updateGenres,
  } = useAlbumLibrary(owner);

  const [isReady, setIsReady] = useState(false);

  const [albumMenu, setAlbumMenu] = useState(false);


  const [shuffledAlbums, setShuffledAlbums] = useState<Album[]>([]);
  const [albumIndex, setAlbumIndex] = useState(0);

  const [queueMode, setQueueMode] = useState<boolean>(false);
  const prevQueueMode = useRef(queueMode);
  const isSwitchingLibrary = useRef(false);

  const [queueProgress, setQueueProgress] = useState<Album[]>([]);

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

  const [isCoverLoading, setIsCoverLoading] = useState(true);

  const activeLibraryRef = useRef(owner);
  activeLibraryRef.current = owner;


  const toggleQueueMode = async (current: boolean) => {
    const next = !current;
    setQueueMode(next);
    if (current) {
      const queueSnapshot = [...queueProgress];
      await saveQueue(owner, queueSnapshot);
      reshuffleAlbums(next);
    }
    else {
      await getQueue();
    }
  }

  const getQueue = async () => {
    try {
      const saved = await AsyncStorage.getItem(LAST_QUEUE+owner);
      if (!saved) {
        setShuffledAlbums([]);
        return;
      }
      const keys: string[] = JSON.parse(saved);
      if (!keys.length) {
        setShuffledAlbums([]);
        return;
      }
      const albumMap = new Map(
        albums.map(a => [makeKey(a), a])
      );

      const queuedAlbums = keys
        .map(key => albumMap.get(key))
        .filter((a) => a !== undefined);

      setShuffledAlbums(queuedAlbums);
    } catch (e) {
      console.error("Failed to load queue", e);
      setShuffledAlbums([]);
    }
  };

  const makeKey = (a: { title: string; artist: string }) =>
    `${a.title.trim().toLowerCase()}|${a.artist.trim().toLowerCase()}`;

  const saveQueue = async (libOwner: string, albumsToSave: Album[]) => {
    try {
      const keys = albumsToSave.map(makeKey);
      await AsyncStorage.setItem(LAST_QUEUE+libOwner, JSON.stringify(keys));
    } catch (e) {
      console.error("Failed to save queue", e);
    }
  };

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



  const deckStructureKey = JSON.stringify(
    albums.map((album) => ({
      id: album.$id,
      sides: album.sides,
      genres: album.genres,
    }))
  );

  useEffect(() => {
    if (!owner || loadedLibraryId !== owner) return;

    reshuffleAlbums(queueMode);
  }, [loadedLibraryId, owner, deckStructureKey, selectedGenres, shuffleMode]);



  const reshuffleAlbums = (queue: boolean) => {
    if(queue) return;
    let pool: Album[] = albums;

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
  };

  const queueAlbum = (album: Album) => {
    Haptics.selectionAsync();
    setShuffledAlbums((prev) => [...prev, album]);
  }

  const changeLibrary = async () => {
    if (queueMode) {
      await toggleQueueMode(queueMode);
    }
    //isSwitchingLibrary.current = true;
    //setQueueMode(false);
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

  if (isLoading || (owner !== "" && loadedLibraryId !== owner)) {
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
            <AlbumCards
              albums={shuffledAlbums}
              latestAlbums={albums}
              reShuffleAlbums={reshuffleAlbums}
              queueMode={queueMode}
              onQueueEmpty={() => setShuffledAlbums([])}
              onProgressChange={setQueueProgress}
            />
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
          {loadError && (
            <Text className="text-red-400 text-center px-4">
              {loadError}
            </Text>
          )}
          <AddAlbumModal
            visible={albumMenu}
            onClose={() => setAlbumMenu(false)}
            onAdd={addAlbum}
          />
          <SettingsModal
            visible={settingsMenu}
            onClose={() => {
              setSettingsMenu(false);
            }}
            shuffleMode={shuffleMode}
            setShuffleMode={setShuffleMode}
            queueMode={queueMode}
            toggleQueueMode={toggleQueueMode}
            selectedGenres={selectedGenres}
            toggleGenre={toggleGenre}
            allGenres={allGenres}
          />
          <ShowLibrary
            visible={library}
            albums={albums}
            queueMode={queueMode}
            selectedGenres={selectedGenres}
            onUpdateAlbumGenres={updateGenres}
            onRemoveAlbumL={removeAlbum}
            onClose={() => {setLibrary(false)}}
            queueAlbum={queueAlbum}
          />
        </View>
      </LinearGradient>
    </GestureHandlerRootView>
  )
}
