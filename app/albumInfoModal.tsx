import React, {useEffect, useRef, useState} from "react";
import {getColors, ImageColorsResult} from 'react-native-image-colors';
import invert from 'invert-color';
import {
  Animated,
  Modal,
  View,
  Text,
  Image,
  TouchableWithoutFeedback,
  Dimensions,
  StyleSheet, Pressable,
  TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import pressable from "react-native-gesture-handler/src/components/Pressable";

type AndroidColors = {
  average?: string;
  dominant?: string;
  vibrant?: string;
  lightVibrant?: string;
  darkVibrant?: string;
  lightMuted?: string;
  muted?: string;
  darkMuted?: string;
  platform: "android" | string;
};

export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[],
  sideLetter?: string;
}

interface Props {
  visible: boolean;
  album: Album | null;
  onClose: () => void;
  cardSize?: number;
  onUpdateGenres?: (genres: string[]) => void;
  onRemoveAlbum?: (album: Album) => void;
}

const { width: screenWidth } = Dimensions.get("window");

export default function AlbumInfoModal({
  visible,
  album,
  onClose,
  cardSize = Math.floor(screenWidth * 0.82),
  onUpdateGenres,
  onRemoveAlbum,
}: Props) {
  const [colors, setColors] = useState<AndroidColors | null>(null)
  const [top, setTop] = useState<string>("#1e293b")
  const [bottom, setBottom] = useState<string>("#0f172a")
  const [textColor, setTextColor] = useState<string>(invert("#1e293b"))
  const anim = useRef(new Animated.Value(0)).current;
  //const [localAlbum, setLocalAlbum] = useState<Album | null>(album || null);

  const [editGenres, setEditGenres] = useState<boolean>(false);
  const [newGenre, setNewGenre] = useState<string>("");
  // anim: 0 = hidden, 1 = shown

  /*useEffect(() => {
    setLocalAlbum(album);
  }, [album]);*/

  useEffect(() => {
    if(!visible) {
      setEditGenres(false);
      setNewGenre("");
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible, anim]);

  useEffect(() => {
    if(!album?.url) return;
    (async () => {
      const returnColors = await getColors(album.url, {
        fallback: '#121212',
        cache: true,
        key: album.url,
      })
      setColors(returnColors)
    })();
  }, [album]);

  useEffect(() => {
    if (!colors) return;
    const candidateTop = colors.lightVibrant !== "#121212" ? colors.lightVibrant:
      colors.lightMuted !== "#121212" ? colors.lightMuted:
        colors.vibrant !== "#121212" ? colors.vibrant: colors.average;
    const candidateBottom = colors.darkVibrant !== "#121212" ? colors.darkVibrant:
      colors.darkMuted !== "#121212" ? colors.darkMuted:
        colors.dominant !== "#121212" ? colors.dominant:
          colors.muted !== "#121212" ? colors.muted: colors.average;

    const newTop = candidateTop ?? "#1e293b";
    const newBottom = candidateBottom ?? "#0f172a";

    if(newTop !== top) {
      setTop(newTop);
      setTextColor(invert(newTop));
    }
    if(newBottom !== bottom) setBottom(newBottom);
  }, [colors]);

  const handleAddGenres = () => {
    if(!album) return;
    const trimmed = newGenre.trim();
    if(!trimmed) return;

    const updated = Array.from(new Set([...(album.genres || []), trimmed.toLowerCase()]));

    onUpdateGenres?.(updated);
    setNewGenre("");
  }

  const handleRemoveGenre = (genre: string) => {
    if(!album) return;
    const updated = album.genres.filter(g => g !== genre);

    onUpdateGenres?.(updated);
  }

  const handleRemoveAlbum = (album : Album) => {
    if(!album) return;
    onRemoveAlbum?.(album);
  }

  if (!album) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });

  if (!album) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.overlay, { opacity: 0.6 }]} />
        </TouchableWithoutFeedback>

        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.card,
              {
                width: cardSize,
                transform: [{ translateY }, { scale }],
              },
            ]}
          >
            <Image source={{ uri: album.url }} style={[styles.image, { width: cardSize, height: cardSize }]} resizeMode="cover" />
            {editGenres && (
              <Pressable
                style={styles.minusBadgeAlbum}
                onPress={() => {
                  Haptics.selectionAsync();
                  handleRemoveAlbum(album);
                }}
              >
                <View >
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 10 }}>−</Text>
                </View>
              </Pressable>
            )}
            <LinearGradient
              colors={[top, bottom]}
              style={[styles.info]}
            >
              <Text style={[styles.title, {color: textColor}]}>Title: {album.title}</Text>
              <Text style={[styles.artist, {color: textColor}]}>Artist: {album.artist}</Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, {color: textColor}]}>Sides: {album.sides}</Text>
              </View>
              {Array.isArray(album.genres) && (
                <>
                  <View style={styles.genresWrap}>
                    {album.genres.map((g, i) => (
                      <Pressable
                        key={`${g}-${i}`}
                        disabled={!editGenres}
                        onPress={() => {
                          if (editGenres) {
                            Haptics.selectionAsync();
                            handleRemoveGenre(g);
                          }
                        }}
                        style={[styles.genreChip, { backgroundColor: invert(bottom), position: "relative" }]}
                      >
                        <Text style={[styles.genreText, {color: bottom}]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                        {editGenres && (
                          <View style={styles.minusBadge}>
                            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 10 }}>−</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                  <View
                    style={styles.editRow}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setEditGenres((prev) => !prev);
                      }}
                    >
                      <View style={[styles.genreChip, {backgroundColor: invert(bottom)}]}>
                        <Text style={[styles.genreText, {color: bottom}]}>{editGenres ? "Done" : "Edit"}</Text>
                      </View>
                    </Pressable>

                    {editGenres && (
                      <>
                        <TextInput
                          value={newGenre}
                          onChangeText={setNewGenre}
                          placeholder="New genre"
                          placeholderTextColor={invert(bottom)}
                          style={[styles.genreInput, {borderColor: invert(bottom), color: invert(bottom), width: 80,},]}
                          onSubmitEditing={() => {
                            Haptics.selectionAsync();
                            handleAddGenres();
                          }}
                          returnKeyType="done"
                        />
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            handleAddGenres();
                          }}>
                          <View style={[styles.genreChip, {backgroundColor: invert(bottom)}]}>
                            <Text style={[styles.genreText, {color: bottom}]}>Add</Text>
                          </View>
                        </Pressable>
                      </>
                    )}
                  </View>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  minusBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 20,
    backgroundColor: "red",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  minusBadgeAlbum: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 20,
    backgroundColor: "red",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  genreInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    fontSize: 12,
    height: 32,
    textAlignVertical: "center"
  },
  genresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 10,
    gap: 8, // RN 0.71+ supports gap; otherwise rely on margin in chips
  },
  genreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  genreChip: {
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    height: 32,
    justifyContent: "center",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  modalRoot: {
    flex: 1,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cardContainer: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  image: { width: "100%", height: "100%" },
  info: { padding: 14},
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  artist: { fontSize: 16, marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 6 },
  metaLabel: { fontSize: 15, fontWeight: "600", marginRight: 8 },
  metaValue: { color: "#333" },
  description: { color: "#333", marginTop: 8 },
});
