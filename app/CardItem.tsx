import {Image, Pressable, StyleSheet, Text, View} from "react-native";
import React, {useEffect, useState} from "react";
import LottieView from "lottie-react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import Animated, {useAnimatedStyle, useSharedValue, withDecay, withSpring, withTiming} from "react-native-reanimated";
import {scheduleOnRN} from "react-native-worklets";
import invert from "invert-color";
import * as Haptics from "expo-haptics";
export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[],
  trackList: string[],
  sideLetter?: string;
}
type Props = {
  index: number;
  album: Album;
  shuffleCards: () => void;
};
const CardItem = ({index, album, shuffleCards}: Props) => {
  const [isCoverLoading, setIsCoverLoading] = useState(true);
  const [showTracks, setShowTracks] = useState<boolean>(false);

  const transformX = useSharedValue(0);
  const transformY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const decayConfig = { rubberBandEffect: false, clamp: [-300, 300] as [number, number] };
  const resetFunction = () => {
    "worklet";
    opacity.value = withTiming(1, {duration: 300});
    scheduleOnRN(shuffleCards);
  }

  const gesture = Gesture.Pan().onUpdate((e) => {
    if(index < 2) {
      transformX.value = e.translationX;
      transformY.value = e.translationY;
    }
  }).onEnd(() => {
    const isLeftSwipe = transformX.value < -100;
    const isRightSwipe = transformX.value > 100;
    const isUpSwipe = transformY.value < -50;
    const isDownSwipe = transformY.value > 50;
    if(isLeftSwipe) {
      opacity.value = withSpring(0);
      transformX.value = withDecay({velocity: -1000, ...decayConfig},resetFunction);
      if(isUpSwipe) transformY.value = withDecay({velocity: -500, ...decayConfig}, resetFunction);
      if(isDownSwipe) transformY.value = withDecay({velocity: 500, ...decayConfig}, resetFunction);
    }
    else if(isRightSwipe) {
      opacity.value = withSpring(0);
      transformX.value = withDecay({velocity: 1000, ...decayConfig}, resetFunction);
      if(isUpSwipe) transformY.value = withDecay({velocity: -500, ...decayConfig}, resetFunction);
      if(isDownSwipe) transformY.value = withDecay({velocity: 500, ...decayConfig}, resetFunction);
    } else {
      opacity.value = withSpring(1);
      transformX.value = withSpring(0, {damping: 60, stiffness: 1000});
      transformY.value = withSpring(0, {damping: 60, stiffness: 1000});
    }

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

  const parseTrack = (track: string) => {
    const index = track.lastIndexOf(" - ");

    if (index === -1) {
      return { title: track, duration: "" };
    }

    return {
      title: track.slice(0, index),
      duration: track.slice(index + 3),
    };
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
        ]}>
          {isCoverLoading ? (
            <LottieView
              source={require("../assets/images/turntable.json")}
              autoPlay
              loop
              style={{width: 180, height: 180}}
            />
          ) : null}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowTracks(!showTracks)
          }}
        >
          {showTracks ? (
            <View className="absolute z-10 p-3 h-full bg-black/50">
              {album.trackList?.length ? (
                album.trackList.map((track: string, i: number) => {
                  const {title, duration} = parseTrack(track);
                  if (i > 13) return null;
                  if (i === 13) return (<Text className="text-gray-200 text-center" style={{fontSize: 12}} key={i}>And more!</Text>);
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center"}}>
                        <Text style={{ color: "#e5e7eb", fontSize: 12}}>{i + 1}. </Text>
                        <Text
                          style={{ color: "#e5e7eb", flexShrink: 1, fontSize: 12 }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >{title}</Text>
                      </View>

                      <Text
                        style={{
                          color: "#e5e7eb",
                          fontSize: 12,
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
                <Text style={{ color: "#e5e7eb" }}>No tracklist available</Text>
              )}
          </View>
          ):null}
          <Image
            source={{ uri: album?.url ? album.url : "https://placehold.co/250x250?text=No+Cover", width: 250, height: 250}}
            style={{width: "100%", height: "100%", borderRadius: 16, opacity: isCoverLoading ? 0 : 1}}
            onLoadStart={() => setIsCoverLoading(true)}
            onLoadEnd={() =>  setIsCoverLoading(false)}
          />
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