import {Album} from "@/app/library";
import {memo, useCallback} from "react";
import * as Haptics from "expo-haptics";
import {TouchableOpacity, View, Text} from "react-native";
import AlbumCover from "@/app/albumCover";

type Props = {
  album: Album;
  itemSize: number;
  onSelect: (album: Album) => void;
}

function AlbumGridItem({album, itemSize, onSelect}: Props) {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onSelect(album);
  }, [album, onSelect]);

  return (
    <View style={{ width: itemSize, marginBottom: 12}}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
      >
        <AlbumCover uri={album.url}/>
        <Text className="text-white text-center mt-1">{album.artist}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default memo(AlbumGridItem);