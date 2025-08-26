import {View, Text, Pressable} from 'react-native'
import React from 'react'

export default function ShuffleButton({ callParentFunction }: { callParentFunction: () => void }) {
    return (
        <View>
            <Pressable
                className="border-black border-2 rounded-md bg-black/20"
                onPress={callParentFunction}
            >
                <Text className="text-3xl font-bold m-2">
                    Shuffle an Album!
                </Text>
            </Pressable>
        </View>
    )
};