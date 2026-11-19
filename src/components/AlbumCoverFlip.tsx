import {ReactNode, useEffect} from "react";
import {StyleProp, View, ViewStyle, StyleSheet} from "react-native";
import Animated, {Easing, useAnimatedStyle, useSharedValue, withTiming} from "react-native-reanimated";

type Props = {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
};

export default function AlbumCoverFlip({flipped, front, back, style, duration = 500,}: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(flipped ? 180 : 0, { duration, easing: Easing.inOut(Easing.cubic),});
  }, [flipped, duration, rotation]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000},
      { rotateY: `${rotation.value}deg`},
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000},
      { rotateY: `${rotation.value + 180}deg`},
    ],
  }));

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.face, frontStyle]}
      >
        {front}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.face, backStyle]}
      >
        {back}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
});