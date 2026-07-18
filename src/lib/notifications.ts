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

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission denied");
  }

  const projectId = "b4b959e8-ff21-43dc-9f0f-541a3f5809bb";

  console.log("Expo Config");
  console.log(Constants.expoConfig);

  console.log("ProjectId");
  console.log(projectId);
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#CA4B20",
    });
  }

  return token.data;
}
