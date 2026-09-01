/**
 * lib/notifications.ts
 *
 * Helper used solely for obtaining the Expo Push Token and
 * requesting permission — NOT for setting up the notification handler
 * (that lives in useNotifications.ts to avoid duplicate calls).
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

export async function registerForPushNotificationsAsync(): Promise<string> {
  if (!Device.isDevice) {
    throw new Error("Must use physical device for push notifications");
  }

  // Android 13+ will not return a push token until at least one channel
  // exists. Create it before requesting notification permission.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "إشعارات سفرة",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4A2A1F",
      sound: "default",
      enableVibrate: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission denied");
  }

  const projectId = (
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  ) as string | undefined;
  if (!projectId) {
    throw new Error("Expo project ID is not configured");
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}
