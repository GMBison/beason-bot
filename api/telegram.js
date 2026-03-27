"use strict";

const { handleTelegramUpdate, assertTelegramSecret } = require("../lib/bot");
const { readJsonBody, sendJson, methodNotAllowed } = require("../lib/http");
const logger = require("../lib/logger");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "telegram-webhook" });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  if (!assertTelegramSecret(req)) {
    return sendJson(res, 401, { ok: false, error: "Invalid Telegram webhook secret." });
  }

  try {
    const update = await readJsonBody(req);
    await handleTelegramUpdate(update);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    logger.error("telegram_webhook_failed", { error: error.message });
    return sendJson(res, 500, { ok: false, error: error.message });
  }
};
