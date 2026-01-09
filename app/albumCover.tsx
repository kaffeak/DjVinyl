import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { Image } from "expo-image";
import { useState } from "react";

type Props = {
  uri: string,
};

export default function AlbumCover({ uri }: Props) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <LottieView
            source={require("../assets/images/turntable.json")}
            autoPlay={true}
            loop={true}
            style={{ width: 80, height: 80 }}
          />
        </View>
      )}
      <Image
        source={uri}
        cachePolicy="memory-disk"
        transition={200}
        onLoadEnd={() => setLoading(false)}
        style={styles.image}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#020617",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
})