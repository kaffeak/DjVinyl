import React from "react";
import { View, Text } from "react-native";
import LottieView from "lottie-react-native";

export default function LoadingScreen() {
    return (
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#0f172a", // dark background
            }}
        >
            <LottieView
                source={require("../assets/images/turntable.json")}
                autoPlay
                loop
                style={{ width: 250, height: 250 }}
            />
            <Text style={{ color: "white", marginTop: 20, fontSize: 18, fontWeight: "600" }}>
                Spinning up your vinyls...
            </Text>
        </View>
    );
}