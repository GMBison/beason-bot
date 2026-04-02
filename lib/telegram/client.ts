import { env } from "@/lib/env";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(
  chatId: number | bigint,
  text: string,
  options?: {
    inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
  },
) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId.toString(),
      text,
      parse_mode: "HTML",
      reply_markup: options?.inlineKeyboard
        ? { inline_keyboard: options.inlineKeyboard }
        : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send Telegram message: ${await response.text()}`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const response = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to answer callback query: ${await response.text()}`);
  }
}
