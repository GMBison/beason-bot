"use strict";

const { getConfig } = require("../lib/config");
const { createPaymentForOrderInput } = require("../lib/orders");
const { readJsonBody, sendJson, methodNotAllowed } = require("../lib/http");
const logger = require("../lib/logger");

function assertInternalApiKey(req) {
  const config = getConfig();
  if (!config.internalApiKey) return true;
  return String(req.headers["x-internal-api-key"] || "") === config.internalApiKey;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "create-payment" });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  if (!assertInternalApiKey(req)) {
    return sendJson(res, 401, { ok: false, error: "Invalid internal API key." });
  }

  try {
    const body = await readJsonBody(req);
    const payment = await createPaymentForOrderInput({
      telegramUserId: Number(body.telegram_user_id),
      telegramUsername: body.telegram_username || "",
      fullName: body.full_name,
      email: body.email,
      hwid: body.hwid,
    });

    return sendJson(res, 200, {
      ok: true,
      reused: payment.reused,
      order_code: payment.order.order_code,
      payment_url: payment.paymentUrl,
      hwid: payment.order.hwid,
      amount_kobo: payment.order.amount_kobo,
      currency: payment.order.currency,
    });
  } catch (error) {
    logger.error("create_payment_failed", { error: error.message });
    return sendJson(res, 400, { ok: false, error: error.message });
  }
};
