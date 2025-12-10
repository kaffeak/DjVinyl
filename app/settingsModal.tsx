import {Modal, Pressable, ScrollView, Text, View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

type SettingsModalProps={
    visible: boolean;
    onClose: () => void;
    shuffleMode: "albums" | "sides";
    setShuffleMode: (mode: "albums" | "sides") => void;
    selectedGenres: string[];
    toggleGenre: (genre: string) => void;
    allGenres: Record<string, number>;
}

export default function SettingsModal({
    visible,
    onClose,
    shuffleMode,
    setShuffleMode,
    selectedGenres,
    toggleGenre,
    allGenres,
    }: SettingsModalProps) {
    const genres = Object.entries(allGenres)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-center items-center bg-black/50">
                <View
                    className="bg-white rounded-2xl p-6 shadow-lg"
                    style={{
                        width: '80%',
                        maxHeight: '80%',
                    }}
                >
                    <Text className="text-2xl font-bold mb-4 text-center text-gray-800">Settings</Text>
                    <View className="flex-row justify-around mb-6">
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                setShuffleMode("albums")
                            }}
                            style={{
                                flex: 1,
                                marginRight: 8,
                                borderRadius: 12,
                                overflow: "hidden",
                                elevation: shuffleMode === "albums" ? 4 : 0,
                            }}
                        >
                            <LinearGradient
                                colors={
                                    shuffleMode === "albums"
                                        ? ["#3B82F6", "#2563EB"]
                                        : ["#E5E7EB", "#D1D5DB"]
                                }
                                style={{
                                    padding: 12,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: shuffleMode === "albums" ? "white" : "#374151",
                                        fontWeight: "700",
                                    }}
                                >
                                    Albums
                                </Text>
                            </LinearGradient>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                setShuffleMode("sides")
                            }}
                            style={{
                                flex: 1,
                                marginLeft: 8,
                                borderRadius: 12,
                                overflow: "hidden",
                                elevation: shuffleMode === "sides" ? 4 : 0,
                            }}
                        >
                            <LinearGradient
                                colors={
                                    shuffleMode === "sides"
                                        ? ["#10B981", "#059669"]
                                        : ["#E5E7EB", "#D1D5DB"]
                                }
                                style={{ padding: 12, alignItems: "center" }}
                            >
                                <Text
                                    style={{
                                        color: shuffleMode === "sides" ? "white" : "#374151",
                                        fontWeight: "700",
                                    }}
                                >
                                    Sides
                                </Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
                    <Text className="text-lg font-semibold mb-2 text-gray-800">Filter by Genre</Text>
                    <ScrollView
                        style={{maxHeight: '80%'}}
                        contentContainerStyle={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            justifyContent: "center",
                        }}
                    >
                        {genres.map(([genre, count]) => {
                            const active = selectedGenres.includes(genre);
                            return (
                                <Pressable
                                    key={genre}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        toggleGenre(genre)
                                    }}
                                    style={{
                                        margin: 5,
                                        borderRadius: 16,
                                        overflow: "hidden",
                                        elevation: active ? 3 : 0,
                                    }}
                                >
                                    <LinearGradient colors={
                                        active
                                            ? ["#EC4899", "#DB2777"]
                                            : ["#F3F4F6", "#E5E7EB"]
                                        }
                                        style={{
                                            paddingVertical: 6,
                                            paddingHorizontal: 12,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                color: active ? "white" :  "#374151",
                                                fontWeight: "600",
                                            }}
                                        >{genre.charAt(0).toUpperCase() + genre.slice(1)} ({count})</Text>
                                    </LinearGradient>
                                </Pressable>
                            )
                        })}
                    </ScrollView>
                    <View className="mt-6 flex-row space-x-2 justify-around items-center">
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                selectedGenres.forEach(g => toggleGenre(g))
                            }}
                            style={{
                                borderRadius: 999,
                                overflow: "hidden",
                                elevation: 4,
                            }}
                        >
                            <LinearGradient
                                colors={["#FBBF24", "#F59E0B"]}
                                style={{
                                    paddingVertical: 10,
                                    paddingHorizontal: 24,
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{
                                    color: "white",
                                    fontWeight: "700",
                                }}>Reset Genres</Text>
                            </LinearGradient>
                        </Pressable>
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
            </View>
        </Modal>
    )
}