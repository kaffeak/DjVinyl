import {Image, StyleSheet, Text, View} from "react-native";
import React, {useEffect, useState} from "react";
import LottieView from "lottie-react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import Animated, {useAnimatedStyle, useSharedValue, withDecay, withSpring, withTiming} from "react-native-reanimated";
import {scheduleOnRN} from "react-native-worklets";
export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[],
  sideLetter?: string;
}
type Props = {
  index: number;
  album: Album;
  shuffleCards: () => void;
};
const CardItem = ({index, album, shuffleCards}: Props) => {
  const [isCoverLoading, setIsCoverLoading] = useState(true);

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
    transformX.value = e.translationX;
    transformY.value = e.translationY;
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
      index === 0 ? 0 : index % 2 ? 10 : index % 3 === 1 ? -10 : index % 4 === 1 ? 5 : -5,
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
              source={require("../assets/images/turntable.json")}
              autoPlay
              loop
              style={{width: 180, height: 180}}
            />
          ) : null}
          <Image
            source={{ uri: album?.url ? album.url : "https://placehold.co/250x250?text=No+Cover", width: 250, height: 250}}
            style={{width: "100%", height: "100%", borderRadius: 16, opacity: isCoverLoading ? 0 : 1}}
            onLoadStart={() => setIsCoverLoading(true)}
            onLoadEnd={() =>  setIsCoverLoading(false)}
          />
      </Animated.View>
    </GestureDetector>
  )
}
export default CardItem;

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