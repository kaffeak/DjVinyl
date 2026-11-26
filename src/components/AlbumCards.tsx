import React, {useRef} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import CardItem from "@/src/components/CardItem";
import ShuffleButton from "@/src/components/shuffleButton";
import {DeckCard} from "@/src/hooks/useAlbumDeck";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  cards: DeckCard[];
  queueMode: boolean;
  onNext: () => void;
  onClearQueue: () => void;
  albumCount: number;
  hasActiveGenreFilters: boolean;
  onOpenLibrary: () => void;
  onOpenAddAlbum: () => void;
  onOpenSettings: () => void;
};

const AlbumCards = ({ cards, queueMode, onNext, onClearQueue, albumCount, hasActiveGenreFilters, onOpenLibrary, onOpenAddAlbum, onOpenSettings }: Props) => {
  const activCardId = useRef<string | null>(null);

  if (cards.length === 0) {
    const emptyState = albumCount === 0 ? {
      title: "Your collection is empty",
      description: "Add your first record to start shuffling!",
      buttonLabel: "Add album",
      icon: "albums-outline" as const,
      onAction: onOpenAddAlbum,
    } : queueMode ? {
      title: "Your queue is empty",
      description:
        "Open your library and select some records to play.",
      buttonLabel: "Open library",
      icon: "list-outline" as const,
      onAction: onOpenLibrary,
    } : hasActiveGenreFilters ? {
      title: "No matching records",
      description:
        "None of your albums match the selected genres.",
      buttonLabel: "Change filters",
      icon: "options-outline" as const,
      onAction: onOpenSettings,
    } : {
      title: "No records available",
      description:
        "Try changing your shuffle settings.",
      buttonLabel: "Open settings",
      icon: "settings-outline" as const,
      onAction: onOpenSettings,
    };

    return (
      <View style={styles.container}>
        <View style={styles.containerInner}>
          <Ionicons
            name={emptyState.icon}
            size={48}
            color="#C4B5FD"
          />
          <Text
            style={{
              color: "#F1F5F9",
              fontSize: 21,
              fontWeight: "700",
              textAlign: "center",
              marginTop: 18,
            }}
          >
            {emptyState.title}
          </Text>
          <Text
            style={{
              color: "#94A3B8",
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {emptyState.description}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.selectionAsync();
              emptyState.onAction();
            }}
            style={{
              backgroundColor: "#8B5CF6",
              paddingHorizontal: 24,
              paddingVertical: 13,
              borderRadius: 999,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {emptyState.buttonLabel}
            </Text>
          </Pressable>
        </View>
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
  containerInner: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  }
})