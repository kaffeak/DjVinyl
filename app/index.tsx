import {Pressable, Text, TextInput, View, Modal} from "react-native";
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
import type {Album, NewAlbumData} from "@/src/types/album";
import {buildSidesList, shuffleArray} from "@/src/utils/albums";
import {db} from "@/src/services/appwrite";
import {
  listAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
} from "@/src/services/albumRepository";
import {fetchAlbumMetadata} from "@/src/services/musicMetadata";
import {isArray} from "node:util";
import AddAlbumModal from "@/src/components/AddAlbumModal";
import {getMetadataNeeds} from "@/src/utils/albumMetadata";


const LAST_LIBRARY_KEY = "lastLibrary";
const LAST_QUEUE = "lastQueue";

const MAX_METADATA_ATTEMPTS = 2;
const METADATA_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_AUTO_RETRIES_PER_LOAD = 3;

type MetadataRetryInfo = {
  attempts: number;
  nextAllowedAt: number;
}

export default function Index() {
  const [owner, setOwner] = useState("");
  const [isReady, setIsReady] = useState(false);

  const [albumMenu, setAlbumMenu] = useState(false);

  const [albums, setAlbums] = useState<any[]>([]);
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
  const [allGenres, setAllGenres] = useState<Record<string, number>>({});
  const [isCoverLoading, setIsCoverLoading] = useState(true);

  const metadataInFlight = useRef(new Set<string>());
  const metadataRetryInfo = useRef(new Map<string, MetadataRetryInfo>());
  const activeLibraryRef = useRef(owner);
  activeLibraryRef.current = owner;

  const canLoadMetadata = (album: Album & {$id: string}, libraryId: string): boolean => {
    const {needsCover, needsTracks} = getMetadataNeeds(album);

    if (!needsCover && !needsTracks) return false;

    const key = `${libraryId}:${album.$id}`;

    if (metadataInFlight.current.has(key)) return false;

    const retryInfo = metadataRetryInfo.current.get(key);

    if (!retryInfo) return true;

    if (retryInfo.attempts >= MAX_METADATA_ATTEMPTS) return false;

    return true;
  };

  const loadAlbumMetadata = async (album: Album & {$id: string}, libraryId: string) => {
    if (!canLoadMetadata(album, libraryId)) return;

    const key = `${libraryId}:${album.$id}`;

    const { needsCover, needsTracks } = getMetadataNeeds(album);

    const previous = metadataRetryInfo.current.get(key);

    metadataRetryInfo.current.set(key, {
      attempts: (previous?.attempts ?? 0) + 1,
      nextAllowedAt: 0,
    });

    metadataInFlight.current.add(key);

    try {
      console.log("[METADATA:START]", album.title);

      const {coverUrl, trackList} = await fetchAlbumMetadata(album.title, album.artist);

      const changes: {
        url?: string;
        trackList?: string[];
      } = {};

      if (needsCover && coverUrl) {
        changes.url = coverUrl;
      }

      if (needsTracks && trackList.length > 0) {
        changes.trackList = trackList;
      }

      if (Object.keys(changes).length === 0) {
        console.warn( "[METADATA:EMPTY]", album.title);
        return;
      }

      await updateAlbum(libraryId, album.$id, changes);

      if (activeLibraryRef.current === libraryId){
        setAlbums((prev) => prev.map((item) => item.$id === album.$id ? {...item, ...changes } : item));
      }

      console.log("[METADATA:SAVED]", {
        album: album.title,
        coverFound: !!coverUrl,
        tracksFound: trackList.length,
      });
    } catch (error) {
      console.error("[METADATA:FAILED]", album.title, error);
    } finally {
      const retryInfo = metadataRetryInfo.current.get(key);

      if (retryInfo) {
        metadataRetryInfo.current.set(key, {
          ...retryInfo,
          nextAllowedAt: Date.now() + METADATA_COOLDOWN_MS,
        });
      }
      metadataInFlight.current.delete(key);
    }
  }

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
        .filter((a): a is Album => !!a);

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
    reshuffleAlbums(queueMode);
  }, [selectedGenres, shuffleMode]);

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

  useEffect(() => {
    if (!owner) return;

    let cancelled = false;

    listAlbums(owner).then((docs) => {
      if (cancelled) return;

      setAlbums(docs);

      const cleanedAlbums: (Album & {$id: string})[] = docs.map((album) => ({
        $id: album.$id,
        title: album.title,
        artist: album.artist,
        url: album.url ?? "",
        sides: album.sides,
        genres: album.genres ?? [],
        trackList: album.trackList ?? [],
      }));

      if (!isSwitchingLibrary.current) {
        setShuffledAlbums(shuffleArray(cleanedAlbums));
        setAlbumIndex(0);
      } else {
        isSwitchingLibrary.current = false;
      }

      const albumsToRetry = cleanedAlbums.filter((album) => canLoadMetadata(album, owner)).slice(0, MAX_AUTO_RETRIES_PER_LOAD);
      console.log("[METADATA:AUTO-RETRY]", {
        libraryId: owner,
        albumsFound: albumsToRetry.length,
      });

      for (const album of albumsToRetry) {
        void loadAlbumMetadata(album, owner);
      }
    }).catch((error) => {
      if (!cancelled){
        console.error("Faild to load albums: ", error);
      }
    });

    return () => {
      cancelled = true;
    }
  }, [owner]);

  const deckStructureKey = JSON.stringify(
    albums.map((album) => ({
      id: album.$id,
      sides: album.sides,
      genres: album.genres,
    }))
  );

  useEffect(() => {
    reshuffleAlbums(queueMode);
  }, [deckStructureKey, selectedGenres, shuffleMode]);

  useEffect(() => {
    const genreCount: Record<string, number> = {};

    albums.forEach((album) => {
      if (Array.isArray(album.genres)) {
        album.genres.forEach((genre: string) => {
          genreCount[genre] = (genreCount[genre] ?? 0) + 1;
        });
      }
    });
    setAllGenres(genreCount);
  }, [albums]);

  const reshuffleAlbums = (queue: boolean) => {
    if(queue) return;
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
  };

  const handleUpdateGenres = async (albumTitle: string, albumArtist: string, newGenres: string[]) => {
    const album = albums.find((a) => a.title === albumTitle && a.artist === albumArtist);

    if (!album) return;

    try {
      await updateAlbum(owner, album.$id, {genres: newGenres});

      setAlbums((prev) => prev.map((item) => item.$id === album.$id ? { ...item, genres: newGenres } : item));
    } catch (error) {
      console.error("Error updating Genres: ", error);
    }
  }

  const addAlbum = async (data: NewAlbumData): Promise<boolean> => {
    if (!owner) {
      console.warn("No library selected");
      return false;
    }

    try {
      const libraryId = owner;

      const newAlbum = await createAlbum(libraryId, data);

      const createRecord: Album & {$id: string} = {
        $id: newAlbum.$id,
        title: data.title,
        artist: data.artist,
        sides: data.sides,
        genres: data.genres,
        url: typeof newAlbum.url === "string" ? newAlbum.url : "",
        trackList: Array.isArray(newAlbum.trackList) ? newAlbum.trackList : [],
      };

      setAlbums((prev) => [...prev, createRecord]);

      void loadAlbumMetadata(createRecord, libraryId);

      return true;
    } catch (error) {
      console.error("Failed to create album: ", error);
      return false;
    }
  };

  const removeAlbum = async (albumToRemove: Album) => {
    const album = albums.find((a) => a.title === albumToRemove.title && a.artist === albumToRemove.artist);

    if (!album) return;

    try {
      await deleteAlbum(owner, album.$id);

      setAlbums((prev) => prev.filter((item) => item.$id !== album.$id));
    } catch (error) {
      console.error("Failed to remove album: ", error);
    }
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
            onUpdateAlbumGenres={handleUpdateGenres}
            onRemoveAlbumL={removeAlbum}
            onClose={() => {setLibrary(false)}}
            queueAlbum={queueAlbum}
          />
        </View>
      </LinearGradient>
    </GestureHandlerRootView>
  )
}
