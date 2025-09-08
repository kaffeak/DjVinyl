import {View, Text, Pressable, Animated} from 'react-native'
import React, {useRef} from 'react'
import {LinearGradient} from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

export default function ShuffleButton({ callParentFunction }: { callParentFunction: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        callParentFunction();
        Haptics.selectionAsync();
        Animated.sequence([
            Animated.timing(scale, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            })
        ]).start();
    }

    return (
        <Animated.View
            style={{
                transform: [{scale}]
            }}
        >
            <Pressable
                onPress={handlePress}
                style={{
                    borderRadius: 999,
                    overflow: "hidden",
                    elevation: 5,
                    marginTop: 20,
                }}
            >
                <LinearGradient
                    colors={["#34D399", "#10B981"]} // green gradient
                    start={[0, 0]}
                    end={[1, 0]}
                    style={{
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        alignItems: "center",
                    }}
                >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
                        🔀 Shuffle
                    </Text>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    )
};