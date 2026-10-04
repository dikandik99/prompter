// expo-media-library has no web implementation, so require it lazily and only
// on native. Keeps the web bundle (and screenshots/tests) working.
import { Platform } from "react-native";

export async function requestMediaPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const M = require("expo-media-library");
    const res = await M.requestPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

export async function saveToGallery(uri: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const M = require("expo-media-library");
  await M.saveToLibraryAsync(uri);
  return true;
}
