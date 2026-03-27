"use strict";

const { confirmOrderPayment } = require("../lib/orders");
const { verifyWebhookSignature } = require("../lib/paystack");
const { readRawBody, sendJson, methodNotAllowed } = require("../lib/http");
const logger = require("../lib/logger");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "paystack-webhook" });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-paystack-signature"];
  if (!verifyWebhookSignature(rawBody, signature)) {
    return sendJson(res, 401, { ok: false, error: "Invalid Paystack signature." });
  }

  try {
    const event = rawBody ? JSON.parse(rawBody) : {};
    const eventType = String(event.event || "");
    const reference = String(event.data?.reference || "").trim();

    logger.info("paystack_webhook_received", {
      eventType,
      reference,
    });

    if (!reference) {
      return sendJson(res, 200, { ok: true, ignored: true });
    }

    if (eventType === "charge.success" || eventType === "transaction.success") {
      const result = await confirmOrderPayment({ reference });
      return sendJson(res, 200, {
        ok: true,
        processed: !!result.ok,
        order_code: result.order.order_code,
      });
    }

    return sendJson(res, 200, { ok: true, ignored: true, event: eventType });
  } catch (error) {
    logger.error("paystack_webhook_failed", { error: error.message });
    return sendJson(res, 500, { ok: false, error: error.message });
  }
};
