import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  Alert,
  FlatList, TextInput
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {LinearGradient} from "expo-linear-gradient";
import {useCallback, useEffect, useMemo, useState} from "react";
import AlbumInfoModal from "@/app/albumInfoModal";
import AlbumCover from "@/app/albumCover";
import AlbumGridItem from "@/app/albumGridItem";
import {Ionicons} from "@expo/vector-icons";

export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[],
  sideLetter?: string;
}
type libraryProps = {
  albums: Album[],
  onClose: () => void;
  visible: boolean;
  onUpdateAlbumGenres: (albumTitle: string, albumArtist: string, genres: string[]) => void;
  onRemoveAlbumL: (album: Album) => void;
}

export default function ShowLibrary({
  albums,
  onClose,
  visible,
  onUpdateAlbumGenres,
  onRemoveAlbumL,
  }: libraryProps) {
  const [selected, setSelected] = useState<Album | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const itemSize = ((Dimensions.get("window").width) - 48) / 3;
  const flattened: Album[] = Object.values(
    [...albums].reduce<Record<string, Album>>((acc, a) => (acc[a.title.toLowerCase()] ??= a, acc), {})
  );
  const sortedAlbums = flattened.sort((a,b) => {
    const artistCompare = a.artist.trim().localeCompare(b.artist.trim(), undefined, {
      sensitivity: "base",
    });
    if (artistCompare !== 0) return artistCompare;
    return a.title.trim().localeCompare(b.title.trim(), undefined, {
    sensitivity: "base",
    });
  });

  const filteredAlbums = useMemo(() => {
    return sortedAlbums.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.artist.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, sortedAlbums]);

  useEffect(() => {
    if (!selected) return;

    const updated = albums.find(
      a => a.title === selected.title && a.artist === selected.artist
    );

    if (updated) {
      setSelected(updated);
    }
  }, [albums]);

  const confirmRemoveAlbum = (album: Album) => {
    if(!album) return;
    Alert.alert(
      "Remove album?",
        `"${album.title}" by ${album.artist} will be removed from your library.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setSelected(null);
            onRemoveAlbumL(album);
          }
        }
      ],
      {cancelable: true}
      );
  }

  const handleSelect = useCallback((album: Album) => {
    setSelected(album);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <LinearGradient
        colors={["#1e293b", "#0f172a"]} // slate/dark blue
        start={[0, 0]}
        end={[0, 1]}
        style={{ flex: 1 }}
      >
        <View className="flex-1 mt-12">
          <View className="flex-row items-center border-2 border-gray-300 rounded-full py-1 mb-4 mx-4 px-5">
            <TextInput
            value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search for albums or artists"
          placeholderTextColor="#9CA3AF"
          className="flex-1 text-white text-base"
        />
        {searchTerm === "" ? (
          <Ionicons name="search-outline" size={22} color="#9CA3AF"/>
        ) : (
          <Pressable onPress={() => {
            Haptics.selectionAsync();
            setSearchTerm("");
          }}>
            <Ionicons name="close-outline" size={22} color="#EF4444"/>
          </Pressable>
        )}
      </View>
          <FlatList
            data={filteredAlbums}
            keyExtractor={(item) => `${item.artist}-${item.title}`}
            numColumns={3}
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 12}}
            columnWrapperStyle={{ justifyContent: "flex-start"}}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={true}
            renderItem={({item, index}) => (
              <AlbumGridItem
                album={item}
                itemSize={itemSize}
                onSelect={handleSelect}
                index={index}
                numColumns={3}
              />
            )}
          />
          <AlbumInfoModal
            visible={!!selected}
            album={selected}
            onClose={() => setSelected(null)}
            onUpdateGenres={(newGenres) => {
              if(!selected) return;
              onUpdateAlbumGenres(selected.title, selected.artist, newGenres);
            }}
            onRemoveAlbum={(album) => {
              confirmRemoveAlbum(album);
            }}
          />
          <View className="absolute bottom-0 mb-16 left-0 right-0 items-center p-4 ">
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClose()
              }}
              style={{
                borderRadius: 999,
                overflow: "hidden",
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={["#6B7280", "#4B5563"]}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                }}
              >
                <Text style={{
                  color: "white",
                  fontWeight: "700",
                }}>Close</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  )
}