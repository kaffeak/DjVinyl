import React, {useEffect} from "react";
import {StyleSheet, Text, View} from "react-native";
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
  reShuffleAlbums: () => void,
  queueMode: boolean,
  setShuffledAlbums: (albums: Album[]) => void,
  cards: Album[],
  setCards: React.Dispatch<React.SetStateAction<Album[]>>;
}

const AlbumCards = ({albums, reShuffleAlbums, queueMode, setShuffledAlbums, cards, setCards}: Props) => {

  useEffect(() => {
    setCards(albums);
  }, [albums]);
  const shuffleCards = () => {
    const updatedCards = [...cards];
    const firstCard = updatedCards.shift();
    if (firstCard) {
      setCards(updatedCards);
      if(updatedCards.length === 0) {
        if (queueMode) setShuffledAlbums([]);
        else scheduleOnRN(reShuffleAlbums);
      }
    }
  }
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
              if(index < 6) return<CardItem key={album.title + album.artist + album.sideLetter + index} album={album} index={index} shuffleCards={shuffleCards} />;})}
          </View>
          <View style={styles.textContainer}>
            {cards.length > 0 && (
              <Text numberOfLines={2} className="font-bold text-lg text-gray-200 text-center">{cards[0].title} — {cards[0].artist} {cards[0].sideLetter ? ` (Side ${cards[0].sideLetter})` : ""}</Text>
            )}
          </View>
          <View>
            <ShuffleButton callParentFunction={shuffleCards} />
          </View>
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