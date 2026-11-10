import React, {useRef} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import CardItem from "@/src/components/CardItem";
import ShuffleButton from "@/src/components/shuffleButton";
import {DeckCard} from "@/src/hooks/useAlbumDeck";
import * as Haptics from "expo-haptics";

type Props = {
  cards: DeckCard[];
  queueMode: boolean;
  onNext: () => void;
  onClearQueue: () => void;
};

const AlbumCards = ({ cards, queueMode, onNext, onClearQueue }: Props) => {
  const activCardId = useRef<string | null>(null);

  if (cards.length === 0) {
    return (
      <View style={styles.container}>
        <Text className="text-gray-200 font-semibold text-lg text-center">
          {queueMode ?
          "Go into library and queue some records up!" :
          ""
          }
        </Text>
      </View>
    );
  }

  const currentAlbum = cards[0].album;
  return (
    <View style={styles.container}>
      <View style={{
        width: 250,
        height: 250,
        position: "relative",
      }}>
        {cards.slice(0, 6).map(({entryId, album}, index) => (
          <CardItem
            key={entryId}
            album={album}
            index={index}
            shuffleCards={onNext}
            isTop={index === 0}
            activeCardId={activCardId}
          />
        ))}
      </View>
      <View style={styles.textContainer}>
        <Text
          numberOfLines={2}
          className="font-bold text-lg text-gray-200 text-center"
        >
          {currentAlbum.title} - {currentAlbum.artist} {currentAlbum.sideLetter ? ` (Side ${currentAlbum.sideLetter})` : ""}
        </Text>
      </View>
      <ShuffleButton callParentFunction={onNext}/>
      {queueMode && (
        <Pressable
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onClearQueue();
          }}
          style={{
            marginTop: 24,
            paddingVertical: 10,
            backgroundColor: "#ef4444",
            borderRadius: 999,
          }}
        >
          <Text style={{color: "white", fontWeight: "600"}}>Clear Queue</Text>
        </Pressable>
      )}
    </View>
  )
}
export default AlbumCards;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  textContainer: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
})