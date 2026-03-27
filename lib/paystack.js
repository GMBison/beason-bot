"use strict";

const crypto = require("crypto");
const { getConfig } = require("./config");

function getHeaders() {
  const config = getConfig();
  return {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    "Content-Type": "application/json",
  };
}

async function paystackRequest(path, options = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok || data.status !== true) {
    throw new Error(data.message || `Paystack request failed: ${path}`);
  }
  return data.data;
}

async function initializeTransaction({ email, amountKobo, reference, metadata }) {
  const config = getConfig();
  const body = {
    email,
    amount: amountKobo,
    currency: config.license.currency,
    reference,
    metadata,
  };

  if (config.paystack.callbackUrl) {
    body.callback_url = config.paystack.callbackUrl;
  }

  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const config = getConfig();
  const expected = crypto
    .createHmac("sha512", config.paystack.secretKey)
    .update(rawBody, "utf8")
    .digest("hex");
  return expected === String(signatureHeader || "").trim();
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
