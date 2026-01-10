import {Album} from "@/app/library";
import {memo, useCallback} from "react";
import * as Haptics from "expo-haptics";
import {TouchableOpacity, View, Text} from "react-native";
import AlbumCover from "@/app/albumCover";

type Props = {
  album: Album;
  itemSize: number;
  onSelect: (album: Album) => void;
  index: number;
  numColumns: number;
}

function AlbumGridItem({album, itemSize, onSelect, index, numColumns}: Props) {
  const isLastColumn = (index + 1) % numColumns === 0;
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onSelect(album);
  }, [album, onSelect]);

  return (
    <View style={{ width: itemSize, marginBottom: 12, marginRight: isLastColumn ? 0 : 12,}}>
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