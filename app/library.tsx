import {Modal, Pressable, ScrollView, Text, View, Image, Dimensions, TouchableOpacity} from "react-native";
import * as Haptics from "expo-haptics";
import {LinearGradient} from "expo-linear-gradient";
import {useState} from "react";
import AlbumInfoModal from "@/app/albumInfoModal";

type libraryProps = {
  albums: {
    title: string;
    artist: string;
    url: string;
    sides: number;
    genres: string[],
    sideLetter?: string;
  }[],
  onClose: () => void;
  visible: boolean;
}

export default function ShowLibrary({
  albums,
  onClose,
  visible,
  }: libraryProps) {
  const [selected, setSelected] = useState<{
    title: string;
    artist: string;
    url: string;
    sides: number;
    genres: string[],
    sideLetter?: string;
  } | null>(null);
  const itemSize = ((Dimensions.get("window").width) - 48) / 3;
  const flattened: {
    title: string;
    artist: string;
    url: string;
    sides: number;
    genres: string[],
    sideLetter?: string;
  }[] = Object.values(
    [...albums].reduce<Record<string, {
      title: string;
      artist: string;
      url: string;
      sides: number;
      genres: string[],
      sideLetter?: string;
    }>>((acc, a) => (acc[a.title.toLowerCase()] ??= a, acc), {})
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <LinearGradient
        colors={["#1e293b", "#0f172a"]} // slate/dark blue
        start={[0, 0]}
        end={[0, 1]}
        style={{ flex: 1 }}
      >
        <View className="flex-1 mt-6">
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="flex flex-row flex-wrap">
              {sortedAlbums.map((album, index) => (
                <View key={index} style={{width: itemSize, marginLeft: 12, marginBottom: 12}}>
                  <TouchableOpacity onPress={() => setSelected(album)} activeOpacity={0.85}>
                    <Image
                      source={{ uri: album?.url ? album.url : "https://placehold.co/250x250?text=No+Cover"}}
                      className="w-full aspect-square rounded-xl"
                      resizeMode="cover"
                    />
                    <Text className="text-white text-center mt-1">{album.artist}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
          <AlbumInfoModal visible={!!selected} album={selected} onClose={() => setSelected(null)}/>
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