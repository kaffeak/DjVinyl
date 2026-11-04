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
import AddAlbumModal from "@/src/components/AddAlbumModal";
import { useAlbumLibrary} from "@/src/hooks/useAlbumLibrary";
import { useAlbumDeck} from "@/src/hooks/useAlbumDeck";

const LAST_LIBRARY_KEY = "lastLibrary";

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

  const {
    cards,
    queueMode,
    shuffleMode,
    selectedGenres,

    setShuffleMode,
    toggleGenre,
    toggleQueueMode,
    queueAlbum,
    clearQueue,
    nextCard,
  } = useAlbumDeck({
    albums,
    owner,
    loadedLibraryId,
  })

  const [isReady, setIsReady] = useState(false);
  const [albumMenu, setAlbumMenu] = useState(false);
  const [library, setLibrary] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState(false);
  const activeLibraryRef = useRef(owner);
  activeLibraryRef.current = owner;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LAST_LIBRARY_KEY);
        if (saved === process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_USER_TWO_ID && saved !== null)
          setOwner(saved);
        else
          setOwner(process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_USER_ONE_ID ?? "");
      } catch (err) {
        console.log("Failed to load last library", err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const changeLibrary = async () => {
    if (queueMode) await toggleQueueMode(true);

    const userOneId = process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_USER_ONE_ID;
    const userTwoId = process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_USER_TWO_ID;

    const newLibrary = owner === userOneId ? userTwoId : userOneId;

    if (!newLibrary) return;

    selectedGenres.forEach(genre => toggleGenre(genre));
    setOwner(newLibrary);

    try {
      await AsyncStorage.setItem(LAST_LIBRARY_KEY, newLibrary);
    } catch (error) {
      console.error("Failed to save selected library: ", error);
    }
  };

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
                <Text className="mt-4 font-bold text-3xl text-gray-200 text-center">{owner === process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_USER_ONE_ID ? "Alex" : "Mats and Sylvias"} collection</Text>
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
              cards={cards}
              queueMode={queueMode}
              onNext={nextCard}
              onClearQueue={clearQueue}
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
