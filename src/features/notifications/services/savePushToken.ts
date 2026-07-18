import { supabase } from "@/lib/supabase";

export async function savePushToken(
  userId: string,
  token: string
) {
  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform: "android",
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) throw error;
}
