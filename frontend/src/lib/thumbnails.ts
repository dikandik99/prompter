import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";

/** Grab a real frame from a local video. Native only — returns null on web or failure. */
export async function generateThumbnail(videoUri: string): Promise<string | null> {
  if (Platform.OS === "web" || !videoUri) return null;
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 500, quality: 0.6 });
    return uri;
  } catch {
    return null;
  }
}
