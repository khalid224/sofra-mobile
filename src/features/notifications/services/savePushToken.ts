import { supabase } from "@/lib/supabase";
import { Platform } from "react-native";

export async function savePushToken(
  userId: string,
  token: string,
  platform = Platform.OS,
) {
  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        last_used: new Date().toISOString(),
      },
      {
        onConflict: "token",
      }
    );

  if (error) throw error;
}
