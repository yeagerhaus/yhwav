// utils/getNativeMetadata.ts
import { NativeModules } from 'react-native';

const { MetadataModule } = NativeModules;

export async function getMetadataFromNative(uri: string) {
  try {
    const meta = await MetadataModule.getMetadata(uri.replace('file://', ''));
    console.log('Metadata:', meta);

    return {
      title: meta.title || '',
      artist: meta.artist || '',
      album: meta.albumName || '',
      duration: meta.duration || 0,
      artwork: meta.artwork || '', // optional: handle binary art later
    };
  } catch (err) {
    console.warn('Failed to read metadata:', err);
    return {};
  }
}
