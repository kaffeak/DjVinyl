import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  View,
  Text,
  Image,
  TouchableWithoutFeedback,
  Dimensions,
  StyleSheet,
} from "react-native";

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
}

const { width: screenWidth } = Dimensions.get("window");

export default function AlbumInfoModal({
                                         visible,
                                         album,
                                         onClose,
                                         cardSize = Math.floor(screenWidth * 0.82),
                                       }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  // anim: 0 = hidden, 1 = shown

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible, anim]);

  if (!album) return null;

  const overlayOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>

        <View style={styles.center}>
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
            <View style={styles.info}>
              <Text style={styles.title}>Title: {album.title}</Text>
              <Text style={styles.artist}>Artist: {album.artist}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Sides: {album.sides}</Text>
              </View>
              {album.genres && album.genres.length > 0 && (
                <View style={styles.genresWrap}>
                  {album.genres.map((g, i) => (
                    <View key={`${g}-${i}`} style={styles.genreChip}>
                      <Text style={styles.genreText}>{g}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  genresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 10,
    gap: 8, // RN 0.71+ supports gap; otherwise rely on margin in chips
  },
  genreChip: {
    backgroundColor: "#eee",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,   // for RN <0.71
    marginBottom: 8,
  },
  genreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  modalRoot: { flex: 1, justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", zIndex: 10 },
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
  image: { width: "100%", height: "100%" },
  info: { padding: 14 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  artist: { color: "#444", marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 6 },
  metaLabel: { fontWeight: "600", marginRight: 8 },
  metaValue: { color: "#333" },
  description: { color: "#333", marginTop: 8 },
});
