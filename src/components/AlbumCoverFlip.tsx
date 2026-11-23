import {ReactNode, useEffect} from "react";
import {StyleProp, View, ViewStyle, StyleSheet} from "react-native";
import Animated, {Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming} from "react-native-reanimated";

type Props = {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  cornerRadius?: number;
  progress?: SharedValue<number>;
};

export default function AlbumCoverFlip({flipped, front, back, style, duration = 500, cornerRadius = 16, progress}: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (progress) return;

    rotation.value = withTiming(flipped ? 180 : 0, { duration, easing: Easing.inOut(Easing.cubic),});
  }, [flipped, duration, rotation]);

  const frontStyle = useAnimatedStyle(() => {
    const angle = progress ? progress.value * 180 : rotation.value;

    return{
      transform: [
        { perspective: 1000},
        { rotateY: `${angle}deg`},
      ],
    }
  });

  const backStyle = useAnimatedStyle(() => {
    const angle = progress ? progress.value * 180 : rotation.value;

    return {
      transform: [
        { perspective: 1000},
        { rotateY: `${angle + 180}deg`},
      ],
    }
  });

  return (
    <View style={[styles.container, style, {borderRadius: cornerRadius}]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.face, frontStyle, {borderRadius: cornerRadius}]}
      >
        {front}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.face, backStyle, {borderRadius: cornerRadius}]}
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
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
});