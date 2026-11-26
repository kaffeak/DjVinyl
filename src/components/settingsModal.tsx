import {Modal, Pressable, ScrollView, Switch, Text, View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {Ionicons} from "@expo/vector-icons";

type SettingsModalProps={
    visible: boolean;
    onClose: () => void;
    shuffleMode: "albums" | "sides";
    setShuffleMode: (mode: "albums" | "sides") => void;
    queueMode: boolean;
    toggleQueueMode: (queue: boolean) => void;
    selectedGenres: string[];
    toggleGenre: (genre: string) => void;
    allGenres: Record<string, number>;
}

export default function SettingsModal({
    visible,
    onClose,
    shuffleMode,
    setShuffleMode,
    queueMode,
    toggleQueueMode,
    selectedGenres,
    toggleGenre,
    allGenres,
    }: SettingsModalProps) {
    const genres = Object.entries(allGenres)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View className="flex-1 items-center justify-center bg-black/70 px-4">
          <View
            className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900"
            style={{maxHeight: "85%", overflow: "hidden"}}
          >
            <View className="flex-row items-center justify-between border-b border-slate-700 px-5 py-4">
              <View>
                <Text className="text-xl font-bold text-slate-100">Shuffle settings</Text>
                <Text className="mt-1 text-xs text-slate-400">Customize your listening experience</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={() => {
                  void Haptics.selectionAsync();
                  onClose();
                }}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-700"
              >
                <Ionicons
                  name="close"
                  size={23}
                  color="#F1F5F9"
                />
              </Pressable>
            </View>
            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1,}}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingVertical: 22,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-3 text-xs font-semibold tracking-widest text-slate-400">SHUFFLE BY</Text>
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: shuffleMode === 'albums', }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setShuffleMode("albums");
                  }}
                  className={`flex-1 items-center rounded-xl border p-4 ${shuffleMode === "albums" ? "border-violet-400 bg-violet-700" : "border-slate-600 bg-slate-800"}`}
                >
                  <Ionicons
                    name="albums-outline"
                    size={26}
                    color={shuffleMode === "albums" ? "#FFFFFF" : "#94A3B8"}
                  />
                  <Text className="mt-2 font-semibold text-slate-100">Albums</Text>
                  <Text className="mt-1 text-center text-xs text-slate-300">Full records</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: shuffleMode === "sides",
                  }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setShuffleMode("sides");
                  }}
                  className={`flex-1 items-center rounded-xl border p-4 ${shuffleMode === "sides" ? "border-violet-400 bg-violet-700" : "border-slate-600 bg-slate-800"}`}
                >
                  <Ionicons
                    name="disc-outline"
                    size={26}
                    color={shuffleMode === "sides" ? "#FFFFFF" : "#94A3B8"}
                  />
                  <Text className="mt-2 font-semibold text-slate-100">Sides</Text>
                  <Text className="mt-1 text-center text-xs text-slate-300">Individual sides</Text>
                </Pressable>
              </View>
              <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <View className="mr-3 flex-1 flex-row items-center">
                  <Ionicons
                    name="list-outline"
                    size={24}
                    color="#C4B5FD"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-slate-100">Queue mode</Text>
                    <Text className="mt-1 text-xs text-slate-400">{queueMode ? "Manually queue the records" : "Random Shuffle"}</Text>
                  </View>
                </View>
                <Switch
                  accessibilityLabel="Queue mode"
                  value={queueMode}
                  onValueChange={() => {
                    void Haptics.selectionAsync();
                    void toggleQueueMode(queueMode);
                  }}
                  trackColor={{
                    false: "#475569",
                    true: "#7C3AED",
                  }}
                  thumbColor="#F8FAFC"
                />
              </View>
              <View className="mb-3 mt-6 flex-row items-center justify-between">
                <Text className="text-xs font-semibold tracking-widest text-slate-400">GENRE FILTERS</Text>
                <Text className="text-xs font-medium text-violet-300">{selectedGenres.length === 0 ? "All genres" : `${selectedGenres.length} selected`}</Text>
              </View>
              <Text className="mb-4 text-sm text-slate-400">Select the genres you want to include in your shuffle</Text>
              <View className="flex-row items-center justify-center flex-wrap gap-2">
                {genres.map(([genre, count]) => {
                  const active = selectedGenres.includes(genre);

                  return (
                    <Pressable
                      key={genre}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        toggleGenre(genre);
                      }}
                      className={`rounded-full border px-3 py-2 ${active ? "border-violet-400 bg-violet-700" : "border-slate-600 bg-slate-800"}`}
                    >
                      <Text className={`text-sm font-medium ${active ? "text-white" : "text-slate-300"}`}>{
                        genre.charAt(0).toUpperCase() + genre.slice(1)}{" "}({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {genres.length === 0 && (
                <Text className="text-sm text-slate-400">No frequently used genres available</Text>
              )}
            </ScrollView>
            <View className="flex-row gap-3 border-t border-slate-700 p-4">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: selectedGenres.length === 0,
                }}
                disabled={selectedGenres.length === 0}
                onPress={() => {
                  void Haptics.selectionAsync();
                  selectedGenres.forEach((genre) => toggleGenre(genre));
                }}
                className={`flex-1 items-center rounded-xl py-3 ${selectedGenres.length === 0 ? "bg-slate-800 opacity-50" : "bg-slate-700"}`}
              >
                <Text className="font-semibold text-slate-100">Clear filters</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Haptics.selectionAsync();
                  onClose();
                }}
                className="flex-1 items-center rounded-xl bg-violet-600 py-3"
              >
                <Text className="font-semibold text-white">Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
}