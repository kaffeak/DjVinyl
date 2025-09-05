import {View, Text, Pressable} from 'react-native'
import React from 'react'
import {LinearGradient} from "expo-linear-gradient";

export default function ShuffleButton({ callParentFunction }: { callParentFunction: () => void }) {
    return (
        <Pressable
            onPress={callParentFunction}
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
    )
};