import { View } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

export const LibrarySkeleton = () => (
  <SkeletonPlaceholder>
    <View>
      {[...Array(10)].map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 20 }}>
          <View style={{ width: 60, height: 60, borderRadius: 8 }} />
          <View style={{ marginLeft: 10 }}>
            <View style={{ width: 120, height: 16, borderRadius: 4 }} />
            <View style={{ width: 80, height: 12, borderRadius: 4, marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  </SkeletonPlaceholder>
);
