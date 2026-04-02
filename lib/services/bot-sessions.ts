import { supabaseAdmin } from "@/lib/supabase/server";

export type BotSessionState = Record<string, unknown>;

export async function getBotSession(telegramUserId: number) {
  const { data, error } = await supabaseAdmin
    .from("bot_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle<{ flow: string; state: BotSessionState }>();

  if (error) {
    throw new Error(`Failed to fetch bot session: ${error.message}`);
  }

  return data;
}

export async function upsertBotSession(
  telegramUserId: number,
  flow: string,
  state: BotSessionState,
) {
  const { error } = await supabaseAdmin.from("bot_sessions").upsert(
    {
      telegram_user_id: telegramUserId,
      flow,
      state,
    },
    { onConflict: "telegram_user_id" },
  );

  if (error) {
    throw new Error(`Failed to persist bot session: ${error.message}`);
  }
}

export async function clearBotSession(telegramUserId: number) {
  const { error } = await supabaseAdmin
    .from("bot_sessions")
    .delete()
    .eq("telegram_user_id", telegramUserId);

  if (error) {
    throw new Error(`Failed to clear bot session: ${error.message}`);
  }
}
