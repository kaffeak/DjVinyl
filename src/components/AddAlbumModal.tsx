import {NewAlbumData} from "@/src/types/album";
import {useState} from "react";
import {Modal, Pressable, Text, TextInput, View} from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (album: NewAlbumData) => Promise<boolean>;
};

export default function AddAlbumModal({visible, onClose, onAdd}: Props) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [sidesInput, setSidesInput] = useState("");
  const [genresInput, setGenresInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setArtist("");
    setSidesInput("");
    setGenresInput("");
    setError(null);
  };

  const handleClose = () => {
    if (isSaving) return;

    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSaving) return;

    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();
    const parsedSides = Number(sidesInput.trim());

    if (!cleanTitle || !cleanArtist || !Number.isInteger(parsedSides || parsedSides < 1)) {
      setError("Enter a title, artist and valid number of sides.");
      return;
    }

    const genreList = genresInput.split(",").map((genre) => genre.trim().toLowerCase()).filter((genre) => genre.length > 0);

    setIsSaving(true);
    setError(null);

    try {
      const success = await onAdd({title: cleanTitle, artist: cleanArtist, sides: parsedSides, genres: genreList});

      if (success) {
        resetForm();
        onClose();
      } else {
        setError("Could not add the album. Try again.");
      }
    } catch (error) {
      console.error("Failed to add the album", error);
      setError("Something went wrong. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white rounded-2xl p-6 w-80 shadow-lg">
          <Text className="text-2xl font-bold mb-6 text-center text-gray-800">Add New Album</Text>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#9CA3AF"
            className="border border-gray-300 rounded-lg p-3 mb-3"
          />
          <TextInput
            value={artist}
            onChangeText={setArtist}
            placeholder="Artist"
            placeholderTextColor="#9CA3AF"
            className="border border-gray-300 rounded-lg p-3 mb-3"
          />
          <TextInput
            value={sidesInput}
            onChangeText={setSidesInput}
            placeholder="Number of Sides"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg p-3 mb-3"
          />
          <TextInput
            value={genresInput}
            onChangeText={setGenresInput}
            placeholder="Genres (separated by , )"
            placeholderTextColor="#9CA3AF"
            className="border border-gray-300 rounded-lg p-3 mb-3"
          />

          {error && (
            <Text className="text-red-500 mb-3 text-center">{error}</Text>
          )}
          <View className="flex-row justify-around">
            <Pressable
              disabled={isSaving}
              onPress={() => {
                void Haptics.selectionAsync();
                void handleSubmit();
              }}
              className="bg-blue-500 px-4 py-2 rounded-lg"
              style={{ opacity: isSaving ? 0.5 : 1}}
            >
              <Text className="text-white font-semibold">{isSaving ? "Adding..." : "Add"}</Text>
            </Pressable>
            <Pressable
              disabled={isSaving}
              onPress={() => {
                void Haptics.selectionAsync();
                handleClose();
              }}
              className="bg-gray-300 px-4 py-2 rounded-lg"
              style={{ opacity: isSaving ? 0.5 : 1}}
            >
              <Text className="text-gray-800 font-semibold">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}