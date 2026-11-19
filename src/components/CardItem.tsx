import {Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import React, {useEffect, useMemo, useState} from "react";
import LottieView from "lottie-react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import {Image as ExpoImage } from "expo-image";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Dimensions } from "react-native";
import type {Album} from "@/src/types/album";
import {parseTrack} from "@/src/utils/tracks";
import AlbumCoverFlip from "@/src/components/AlbumCoverFlip";

const { width: screenWidth } = Dimensions.get("window");

type Props = {
  index: number;
  album: Album;
  shuffleCards: () => void;
  isTop: boolean;
  activeCardId: React.MutableRefObject<string | null>
};
const CardItem = ({index, album, shuffleCards, isTop, activeCardId}: Props) => {
  const [loadedFrontUrl, setLoadedFrontUrl] = useState<string | null>(null);
  const [loadedBackUrl, setLoadedBackUrl] = useState<string | null>(null);
  const [showTracks, setShowTracks] = useState<boolean>(false);

  const transformX = useSharedValue(0);
  const transformY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const id = useMemo(() => `${album.title}-${album.artist}-${album.sideLetter ?? ""}`, [album]);
  const hasSwiped = useSharedValue(false);
  const overlayOpacity = useSharedValue(0);

  const { height } = Dimensions.get("window");

  const MAX_TRACKS = height < 700 ? 5 : height < 800 ? 6 : 7;

  const visibleTracks = album.trackList?.slice(0, MAX_TRACKS) ?? [];
  const hasMore = album.trackList?.length > MAX_TRACKS;

  const frontCoverUrl = album.url?.trim() || "https://placehold.co/250x250?text=No+Cover";

  const backCoverUrl = album.url?.trim() && album.backCoverUrl?.trim() ? album.backCoverUrl?.trim() : "";

  const isCoverLoading = loadedFrontUrl !== frontCoverUrl;

  const isBackReady = Boolean(backCoverUrl) && loadedBackUrl === backCoverUrl;

  const gesture = Gesture.Pan().onUpdate((e) => {
      if(index < 2) {
        transformX.value = e.translationX;
        transformY.value = e.translationY;
      }
    }).onEnd((e) => {

      const isLeftSwipe = e.translationX < -100;
      const isRightSwipe = e.translationX > 100;
      const isUpSwipe = e.translationY < -50;
      const isDownSwipe = e.translationY > 50;

      const shouldSwipe = isLeftSwipe || isRightSwipe;

      if (shouldSwipe) {
        if (!hasSwiped.value) {
          hasSwiped.value = true;
          runOnJS(shuffleCards)();
        }

        const velocityX = isLeftSwipe ? -1200 : 1200;

        transformX.value = withDecay({
          velocity: velocityX,
          clamp: [-screenWidth, screenWidth],
        });

        if (isUpSwipe) {
          transformY.value = withDecay({ velocity: -500, clamp: [-300, 300] });
        } else if (isDownSwipe) {
          transformY.value = withDecay({ velocity: 500, clamp: [-300, 300] });
        }

        opacity.value = withTiming(0, { duration: 150 });

      } else {
        // snap back
        transformX.value = withSpring(0, { damping: 60, stiffness: 1000 });
        transformY.value = withSpring(0, { damping: 60, stiffness: 1000 });
        opacity.value = withSpring(1);
      }

      activeCardId.current = null;
    });

  useEffect(() => {
    rotation.value = withSpring(
      index === 0 ? 0 : index === 5 ? 0 : ((Math.random() * 5 * index + 5) * (index % 2 ? 1 : -1)),
      {stiffness: 1000, damping: 60,}
    )
  }, [index]);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      zIndex: 1000-index,
      transform: [
        {translateX: transformX.value},
        {translateY: transformY.value},
        {rotate: `${rotation.value}deg`},
      ],
    };
  })

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
        ]}>
          {isCoverLoading ? (
            <LottieView
              source={require("../../assets/images/turntable.json")}
              autoPlay
              loop
              style={{width: 180, height: 180}}
            />
          ) : null}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowTracks(!showTracks);
          }}
          style={{ flex: 1 }}
        >
          <AlbumCoverFlip
            flipped={showTracks}
            front={
              <>
                <ExpoImage
                  source={{uri: frontCoverUrl}}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { opacity: isCoverLoading ? 0 : 1},
                  ]}
                  onLoadEnd={() => {
                    setLoadedFrontUrl(frontCoverUrl);
                  }}
                />

                {!isCoverLoading && album.trackList?.length > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10}}>Tap for tracks</Text>
                  </View>
                )}
              </>
            }
            back={
              <>
                <ExpoImage
                  source={{ uri: frontCoverUrl}}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  style={StyleSheet.absoluteFillObject}
                />
                { backCoverUrl ? (
                  <ExpoImage
                    source={{uri: backCoverUrl}}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { opacity: isBackReady ? 1 : 0 },
                    ]}
                    onLoad={() => {
                      setLoadedBackUrl(backCoverUrl);
                    }}
                  />
                ) : null}

                <View
                  pointerEvents="none"
                  style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: "rgba(0,0,0,0.75)",
                      padding: 12,
                      justifyContent: "flex-start",
                    }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 14,
                      marginBottom: 8,
                      textAlign: "center",
                    }}
                  >
                    Tracklist
                  </Text>

                  {visibleTracks.map((track: string, i: number) => {
                    const { title, duration } = parseTrack(track);

                    return (
                      <View
                        key={i}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ color: "#9CA3AF", width: 20, fontSize: 11 }}>
                          {i + 1}.
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: "#E5E7EB",
                            fontSize: 12,
                          }}
                        >
                          {title}
                        </Text>

                        <Text
                          style={{
                            color: "#9CA3AF",
                            fontSize: 11,
                            marginLeft: 8,
                            minWidth: 35,
                            textAlign: "right",
                          }}
                        >
                          {duration}
                        </Text>
                      </View>
                    );
                  })}

                  {hasMore && (
                    <Text
                      style={{
                        color: "#9CA3AF",
                        textAlign: "center",
                        marginTop: 6,
                        fontSize: 12,
                      }}
                    >And {album.trackList.length - MAX_TRACKS} more...</Text>
                  )}
                </View>
              </>
            }></AlbumCoverFlip>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  )
}
export default React.memo(CardItem);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: 28,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})