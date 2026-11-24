import React, {use, useEffect, useRef, useState} from "react";
import {getColors} from 'react-native-image-colors';
import PagerView from 'react-native-pager-view';
import invert from 'invert-color';
import {
  Animated,
  Modal,
  View,
  Text,
  TouchableWithoutFeedback,
  Dimensions,
  StyleSheet, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type {Album} from "@/src/types/album";
import {parseTrack} from "@/src/utils/tracks";
import {getDisplayedCoverUrl} from "@/src/utils/albumArtwork";
import {Image as ExpoImage} from "expo-image";
import AlbumCoverFlip from "@/src/components/AlbumCoverFlip";
import Reanimated, {
  useEvent,
  useSharedValue,
} from "react-native-reanimated";
import type { PagerViewProps } from "react-native-pager-view";
import type {ArtworkPreview, ArtworkPreviewSearchResult, ArtworkRefreshResult} from "@/src/hooks/useAlbumLibrary";
import { Ionicons } from "@expo/vector-icons";
import ArtworkPreviewModal from "@/src/components/ArtworkPreviewModal";

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
interface Props {
  visible: boolean;
  album: Album | null;
  queueMode: boolean;
  onClose: () => void;
  cardSize?: number;
  onUpdateGenres?: (genres: string[]) => void;
  onRemoveAlbum?: (album: Album) => void;
  queueAlbum: (album: Album) => void;
  onRefreshArtwork: (albumId: string, force?: boolean) => Promise<ArtworkRefreshResult>;
  onPreviewArtwork: (albumId: string) => Promise<ArtworkPreviewSearchResult>;
  onApplyArtworkPreview: (preview: ArtworkPreview) => Promise<ArtworkRefreshResult>;
}

const { width: screenWidth} = Dimensions.get("window");

const AnimatedPagerView = Reanimated.createAnimatedComponent(PagerView);

export default function AlbumInfoModal({
  visible,
  album,
  queueMode,
  onClose,
  cardSize = Math.floor(screenWidth * 0.82),
  onUpdateGenres,
  onRemoveAlbum,
  queueAlbum,
  onRefreshArtwork,
  onPreviewArtwork,
  onApplyArtworkPreview,
}: Props) {
  const [colors, setColors] = useState<AndroidColors | null>(null)
  const [top, setTop] = useState<string>("#1e293b")
  const [bottom, setBottom] = useState<string>("#0f172a")
  const [textColor, setTextColor] = useState<string>(invert("#1e293b"))
  const anim = useRef(new Animated.Value(0)).current;
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedBackUrl, setLoadedBackUrl] = useState<string | null>(null);
  const [refreshingAlbumId, setRefreshingAlbumId] = useState<string | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<ArtworkPreview | null>(null);
  const [searchingArtwork, setSearchingArtwork] = useState(false);
  const [applyingArtwork, setApplyingArtwork] = useState(false);

  const previewRequestId = useRef(0);

  const albumIdRef = useRef(album?.$id);
  albumIdRef.current = album?.$id;

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    previewRequestId.current += 1;
    setArtworkPreview(null);
    setSearchingArtwork(false);
  }, [visible, album?.$id]);

  const isRefreshingArtwork = refreshingAlbumId !== null;

  const pagerRef = useRef<PagerView>(null);

  const [showQueueOptions, setShowQueueOptions] = useState(false);

  const [editGenres, setEditGenres] = useState<boolean>(false);
  const [newGenre, setNewGenre] = useState<string>("");

  const flipProgress = useSharedValue(0);

  const frontCoverUrl = album?.url?.trim() ?? "";

  const backCoverUrl = frontCoverUrl ? album?.backCoverUrl?.trim() ?? "" : "";

  const showLoadedBack = currentPage === 1 && Boolean(backCoverUrl) && loadedBackUrl === backCoverUrl;

  const isBackReady = Boolean(backCoverUrl) && loadedBackUrl === backCoverUrl;

  const onPagerScroll = useEvent<{position: number; offset: number;}>(
    (event) => {
      "worklet";

      if (!event.eventName.endsWith("onPageScroll")) {
        return;
      }

      const progress = event.position + event.offset;

      flipProgress.value = Math.max(0, Math.min(1, progress));
    }, ["onPageScroll"]
  );

  useEffect(() => {
    flipProgress.value = 0;

    if (!visible) return;

    setCurrentPage(0);
    pagerRef.current?.setPageWithoutAnimation(0);
  }, [visible, album?.$id, flipProgress]);

  useEffect(() => {
    if(!visible) {
      setEditGenres(false);
      setNewGenre("");
      setShowQueueOptions(false);
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
    let cancelled = false;

    setColors(null);
    setTop("#1e293b");
    setBottom("#0f172a");
    setTextColor(invert("#1e293b"));

    const imageUrl = album?.url?.trim();

    if (!visible || !imageUrl) return;

    const loadColors = async () => {
      try {
        const result = await getColors(imageUrl, {fallback: "#121212", cache: true, key:imageUrl});

        if (!cancelled) {
          setColors(result);
        }
      } catch (error) {
        console.warn("Could not extract album colors:",error);
      }
    }

    void loadColors();

    return () => {
      cancelled = true;
    }
  }, [album?.url, visible]);

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

  useEffect(() => {
    if (!visible) return;

    setCurrentPage(0);
    pagerRef.current?.setPage(0);
  }, [visible, album?.$id]);

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

  const handleRefindArtwork = async () => {
    if (!album?.$id || searchingArtwork || applyingArtwork) return;

    const albumId = album.$id;
    const requestId = ++previewRequestId.current;

    void Haptics.selectionAsync();
    setSearchingArtwork(true);

    try {
      const result = await onPreviewArtwork(albumId);

      if (requestId !== previewRequestId.current || !visibleRef.current || albumIdRef.current !== albumId) return;

      if (result.status === "ready") {
        setArtworkPreview(result.preview);
        return;
      }

      switch (result.status) {
        case "unchanged":
          Alert.alert("No replacement found", "No different suitable artwork was found.");
          break;

        case "failed":
          Alert.alert( "Artwork search failed",  "Please try again.");
          break;

        case "busy":
          Alert.alert("Already searching",  "An artwork or metadata request is running.");
          break;

        case "skipped":
          Alert.alert("Search skipped", "The album or active library changed.");
          break;
      }
    } catch (error) {
      console.error("[ARTWORK:UI:PREVIEW_FAILED]", error);

      if (requestId === previewRequestId.current && visibleRef.current && albumIdRef.current === albumId) {
        Alert.alert(
          "Artwork search failed",
          "Could not search for replacement artwork."
        );
      }
    } finally {
      if (requestId === previewRequestId.current) setSearchingArtwork(false);
    }
  };

  const handleApplyArtworkPreview = async () => {
    if (!artworkPreview || applyingArtwork) return;

    const selectedPreview = artworkPreview;

    void Haptics.selectionAsync();
    setApplyingArtwork(true);

    try {
      const result = await onApplyArtworkPreview(selectedPreview);

      if (!visibleRef.current || albumIdRef.current !== selectedPreview.albumId) return;

      switch (result) {
        case "updated":
          setArtworkPreview(null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Artwork updated",
            "The selected artwork has been saved."
          );
          break;

        case "unchanged":
          setArtworkPreview(null);
          Alert.alert(
            "No changes",
            "The proposed artwork matches the current artwork."
          );
          break;

        case "skipped":
          setArtworkPreview(null);
          Alert.alert(
            "Preview expired",
            "The album or library changed. Please search again."
          );
          break;

        case "busy":
          Alert.alert(
            "Already updating",
            "Another operation is running for this album."
          );
          break;

        case "failed":
          Alert.alert(
            "Could not save artwork",
            "Please try again."
          );
          break;
      }
    } catch (error) {
      console.error("[ARTWORK:UI:APPLY_FAILED]", error);

      Alert.alert(
        "Could not save artwork",
        "An unexpected error occurred."
      );
    } finally {
      setApplyingArtwork(false);
    }
  };

  const handleModalClose = () => {
    if (applyingArtwork) return;

    if (artworkPreview) {
      setArtworkPreview(null);
      return;
    }

    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleModalClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={handleModalClose}>
          <View style={[styles.overlay, { opacity: 0.6 }]} />
        </TouchableWithoutFeedback>

        <View style={styles.cardContainer} className="max-h-4/5">
          <Animated.View
            style={[
              styles.card,
              {
                width: cardSize,
                height: cardSize * 2.2,
                transform: [{ translateY }, { scale }],
              },
            ]}
          >
            <View
            style={{
              width: "100%",
              aspectRatio: 1,
              flexShrink: 0,
              overflow: "hidden",
              backgroundColor: top,
              position: "relative",
            }}
            >
              <AlbumCoverFlip
                key={album.$id}
                flipped={currentPage === 1}
                style={{ width: "100%", height: "100%"}}
                cornerRadius={0}
                progress={flipProgress}
                front={
                  frontCoverUrl ? (
                    <ExpoImage
                      source={{uri: frontCoverUrl}}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      style={[StyleSheet.absoluteFillObject, {borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12}]}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#1e293b",
                      }}
                    >
                      <Text style={{ color: "#94a3b8"}}>No cover available</Text>
                    </View>
                  )
                }
                back={
                  <>
                  {frontCoverUrl ? (
                    <ExpoImage
                      source={{uri: frontCoverUrl}}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      style={[StyleSheet.absoluteFillObject, {borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12}]}
                    />
                  ) : (
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: "#1e293b",
                      }}
                    />
                  )}
                  {backCoverUrl ? (
                    <ExpoImage
                      source={{uri: backCoverUrl}}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      style={[
                        StyleSheet.absoluteFillObject,
                        { opacity: isBackReady ? 1 : 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12},
                      ]}
                      onLoad={() => {
                      setLoadedBackUrl(backCoverUrl);
                      }}
                      />
                    ) : null }
                  </>
                }
              />
              {editGenres && (
                <View
                  pointerEvents="box-none"
                  style={styles.artworkActionLayer}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Refind album artwork"
                    disabled={searchingArtwork || applyingArtwork}
                    onPress={() => {void handleRefindArtwork()}}
                    style={[
                      styles.refindArtworkButton,
                      isRefreshingArtwork && { opacity: 0.7 },
                    ]}
                  >
                    {searchingArtwork ? (
                      <ActivityIndicator
                        size="small"
                        color="fff"
                      />
                    ) : (
                      <Ionicons
                        name="refresh"
                        size={18}
                        color="#fff"
                      />
                    )}
                    <Text style={styles.refindArtworkText}>
                      {searchingArtwork ? "Searching..." : "Refind Artwork"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, {color: textColor}]}>
                    Title: {album.title}
                  </Text>
                  <Text style={[styles.artist, {color: textColor}]}>
                    Artist: {album.artist}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, {color: textColor}]}>
                      Sides: {album.sides}
                    </Text>
                  </View>
                </View>

                {queueMode && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowQueueOptions((prev) => !prev);
                    }}
                    style={{
                      backgroundColor: invert(bottom),
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: bottom, fontWeight: "600" }}>
                      Queue
                    </Text>
                  </Pressable>
                )}
                {showQueueOptions && (
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      zIndex: 3,
                      marginTop: 8,
                      backgroundColor: "rgba(0,0,0,0.3)",
                      borderRadius: 12,
                      padding: 8,
                      gap: 6,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        queueAlbum(album);
                        setShowQueueOptions(false);
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: invert(bottom),
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ color: bottom, fontWeight: "600" }}>
                        Full album
                      </Text>
                    </Pressable>

                    {album.sides > 1 &&
                      Array.from({ length: album.sides }, (_, i) => {
                        const letter = String.fromCharCode(65 + i);

                        return (
                          <Pressable
                            key={letter}
                            onPress={() => {
                              Haptics.selectionAsync();
                              queueAlbum({ ...album, sideLetter: letter });
                              setShowQueueOptions(false);
                            }}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 8,
                              backgroundColor: invert(bottom),
                              marginBottom: 3,
                            }}
                          >
                            <Text style={{ color: bottom ,fontWeight: "600"}}>
                              Side {letter}
                            </Text>
                          </Pressable>
                        );
                      })}
                    <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowQueueOptions(false)
                    }}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: invert(bottom),
                    }}
                    >
                      <Text style={{ color: bottom, fontWeight: "600" }}>Cancel</Text>
                    </Pressable>
                  </View>

                )}
              </View>
              <AnimatedPagerView
                ref={pagerRef}
                style={{flex: 1}}
                initialPage={0}
                onPageScroll={onPagerScroll as unknown as PagerViewProps["onPageScroll"]}
                onPageSelected={(e) => {
                  setCurrentPage(e.nativeEvent.position);
                }}
              >
                <View className="w-full flex-1" key={1}>
                  <ScrollView
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                  >
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
                  </ScrollView>
                </View>
                <View className="w-full flex-1" key={2}>
                  <ScrollView
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                  >
                  <View  style={styles.songsWrap}>
                  {album.trackList?.length ? (
                    album.trackList.map((track: string, i: number) => {
                      const {title, duration} = parseTrack(track);
                      return (
                      <View
                        key={i}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ color: invert(bottom), width: 24 }}>
                            {i + 1}.
                          </Text>

                          <Text
                            style={{ color: invert(bottom), flexShrink: 1 }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {title}
                          </Text>
                        </View>

                        <Text
                          style={{
                            color: `${invert(bottom)}99`,
                            fontSize: 14,
                            marginLeft: 10,
                            minWidth: 40,
                            textAlign: "right",
                          }}
                        >
                          {duration}
                        </Text>
                      </View>
                    )
                    })
                  ) : (
                    <Text style={{ color: invert(bottom) }}>No tracklist available</Text>
                  )}
                  </View>
                  </ScrollView>
                </View>
              </AnimatedPagerView>
              <View style={{ alignItems: "center", marginTop: 8 }}>
                <View className="flex-row items-center justify-center gap-2">
                  {[0, 1].map((i) => {
                    const isActive = currentPage === i;

                    return (
                      <View
                        key={i}
                        style={{
                          width: isActive ? 10 : 6,
                          height: isActive ? 10 : 6,
                          borderRadius: 999,
                          backgroundColor: invert(bottom),
                          opacity: isActive ? 1 : 0.4,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
        <ArtworkPreviewModal
          preview={artworkPreview}
          saving={applyingArtwork}
          onCancel={() => {
            if (!applyingArtwork) setArtworkPreview(null);
          }}
          onConfirm={() => {
            void handleApplyArtworkPreview();
          }}
        />
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
  songsWrap: {
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
  info: { padding: 14, flex: 1},
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  artist: { fontSize: 16, marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 6 },
  metaLabel: { fontSize: 15, fontWeight: "600", marginRight: 8 },
  metaValue: { color: "#333" },
  description: { color: "#333", marginTop: 8 },
  artworkActionLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 16,
    zIndex: 20,
  },
  refindArtworkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    elevation: 5,
  },
  refindArtworkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
