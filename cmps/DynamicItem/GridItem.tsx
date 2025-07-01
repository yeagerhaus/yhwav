import { Image, Pressable, StyleSheet, Text, Dimensions } from 'react-native';
import { router } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;

interface GridItemProps {
  item: {
    album: string;
    artwork: string;
    count: number;
  };
}

export default function GridItem({ item }: GridItemProps) {
  return (
    <Pressable
      style={styles.gridItem}
      onPress={() =>
        router.push({
          // @ts-expect-error
          pathname: '(library)/(albums)/[albumId]',
          params: { albumId: encodeURIComponent(item.album) },
        })
      }
    >
      <Image source={{ uri: item.artwork }} style={styles.artwork} />
      <Text style={styles.name} numberOfLines={1}>{item.album}</Text>
      <Text style={styles.count}>{item.count} songs</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridItem: {
    width: itemSize,
    marginBottom: 24,
    alignItems: 'center',
  },
  artwork: {
    width: itemSize,
    height: itemSize,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: itemSize,
  },
  count: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
