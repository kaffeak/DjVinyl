import React, {useCallback, useEffect, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import CardItem from "@/app/CardItem";
import {scheduleOnRN} from "react-native-worklets";
import ShuffleButton from "@/app/shuffleButton";
export interface Album {
  title: string;
  artist: string;
  url: string;
  sides: number;
  genres: string[],
  trackList: string[],
  sideLetter?: string,
}
type Props = {
  albums: Album[],
  reShuffleAlbums: (bool: boolean) => void,
  queueMode: boolean,
  onQueueEmpty: () => void,
  onProgressChange?: (cards: Album[]) => void,
}

const AlbumCards = ({ albums, reShuffleAlbums, queueMode, onQueueEmpty, onProgressChange }: Props) => {
  const [cards, setCards] = useState<Album[]>(albums);

  useEffect(() => {
    setCards(prev => {
      if (!queueMode) return albums;
      if (prev.length === 0) return albums;
      const makeKey = (a: Album) => `${a.title}|${a.artist}|${a.sideLetter ?? ""}`;
      const prevFirstKey = makeKey(prev[0]);
      const startIndex = albums.findIndex(a => makeKey(a) === prevFirstKey);
      if (startIndex === -1) return albums;
      return albums.slice(startIndex);
    })
  }, [albums]);

  useEffect(() => {
    onProgressChange?.(cards)
  }, [cards]);

  const shuffleCards = useCallback(() => {
    setCards(prev => {
      if (prev.length === 0) return prev;

      const updated = prev.slice(1);

      if (updated.length === 0) {
        if (queueMode) {
          onQueueEmpty?.();
        } else {
          scheduleOnRN(() => reShuffleAlbums(queueMode));
        }
      }

      return updated;
    });
  }, [queueMode, onQueueEmpty, reShuffleAlbums]);
  return (
    <View style={styles.container}>
      {queueMode && albums.length === 0 ? (
        <View>
          <Text className="text-gray-200 font-semibold text-lg">Go into library and queue some records up!</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <View style={{width: 250, height: 250, position: "relative"}}>
            {cards.map((album, index) => {
              if(index < 6) return<CardItem key={album.title + album.artist + (album.sideLetter ?? "")} album={album} index={index} shuffleCards={shuffleCards} />;})}
          </View>
          <View style={styles.textContainer}>
            {cards.length > 0 && (
              <Text numberOfLines={2} className="font-bold text-lg text-gray-200 text-center">{cards[0].title} — {cards[0].artist} {cards[0].sideLetter ? ` (Side ${cards[0].sideLetter})` : ""}</Text>
            )}
          </View>
          <View>
            <ShuffleButton callParentFunction={shuffleCards} />
          </View>
          {queueMode && cards.length > 0 && (
            <Pressable
            onPress={onQueueEmpty}
            style={{
              marginTop: 24,
              paddingVertical: 10,
              paddingHorizontal: 20,
              backgroundColor: "#ef4444", // red-500
              borderRadius: 999,
            }}
          >
            <Text style={{color: "white", fontWeight: "600"}}>
              Clear Queue
            </Text>
          </Pressable>)}
        </View>
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