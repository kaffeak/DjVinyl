import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  Alert,
  FlatList
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {LinearGradient} from "expo-linear-gradient";
import {useCallback, useState} from "react";
import AlbumInfoModal from "@/app/albumInfoModal";
import AlbumCover from "@/app/albumCover";
import AlbumGridItem from "@/app/albumGridItem";

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
  onUpdateGenres: (albumTitle: string, albumArtist: string, genres: string[]) => void;
  onRemoveAlbum: (album: Album) => void;
}

export default function ShowLibrary({
  albums,
  onClose,
  visible,
  onUpdateGenres,
  onRemoveAlbum,
  }: libraryProps) {
  const [selected, setSelected] = useState<Album | null>(null);
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
            onRemoveAlbum(album);
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
    <Modal visible={visible} transparent animationType="slide">
      <LinearGradient
        colors={["#1e293b", "#0f172a"]} // slate/dark blue
        start={[0, 0]}
        end={[0, 1]}
        style={{ flex: 1 }}
      >
        <View className="flex-1 mt-10">
          {
          <FlatList
            data={sortedAlbums}
            keyExtractor={(item) => `${item.artist}-${item.title}`}
            numColumns={3}
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 12}}
            columnWrapperStyle={{ justifyContent: "space-between"}}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={true}
            renderItem={({item}) => (
              <AlbumGridItem
                album={item}
                itemSize={itemSize}
                onSelect={handleSelect}
              />
            )}
          />
          }
          {/*<ScrollView contentContainerStyle={{paddingBottom: 120}}>
            <View className="flex flex-row flex-wrap">
              {sortedAlbums.map((album, index) => (
                <View key={index} style={{width: itemSize, marginLeft: 12, marginBottom: 12}}>
                  <TouchableOpacity onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(album)
                  }} activeOpacity={0.85}>
                    <Image
                      source={album.url}
                      cachePolicy="memory-disk"
                      transition={150}
                      style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
                    />
                    <Text className="text-white text-center mt-1">{album.artist}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>*/}
          <AlbumInfoModal
            visible={!!selected}
            album={selected}
            onClose={() => setSelected(null)}
            onUpdateGenres={(newGenres) => {
              if(!selected) return;
              sortedAlbums[sortedAlbums.indexOf(selected)].genres = newGenres;
              onUpdateGenres(selected.title, selected.artist, newGenres);
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