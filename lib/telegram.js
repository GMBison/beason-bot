"use strict";

const { getConfig } = require("./config");

function getTelegramApiBase() {
  const config = getConfig();
  return `https://api.telegram.org/bot${config.telegram.botToken}`;
}

async function telegramRequest(method, payload) {
  const response = await fetch(`${getTelegramApiBase()}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API call failed for ${method}.`);
  }
  return data.result;
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

async function answerTelegramCallbackQuery(callbackQueryId, text) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

module.exports = {
  sendTelegramMessage,
  answerTelegramCallbackQuery,
};
