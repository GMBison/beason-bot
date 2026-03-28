"use strict";

let cachedConfig = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : String(value).trim();
}

function normalizePem(rawValue) {
  if (!rawValue) return "";
  if (rawValue.includes("BEGIN")) {
    return rawValue.replace(/\\n/g, "\n").trim();
  }

  try {
    return Buffer.from(rawValue, "base64").toString("utf8").trim();
  } catch {
    return rawValue.replace(/\\n/g, "\n").trim();
  }
}

function asInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getConfig() {
  if (cachedConfig) return cachedConfig;

  const privateKeyPem = normalizePem(
    optionalEnv("LICENSE_PRIVATE_KEY_PEM_BASE64") || optionalEnv("LICENSE_PRIVATE_KEY_PEM")
  );

  if (!privateKeyPem || !privateKeyPem.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "Missing BEASON issuer private key. Set LICENSE_PRIVATE_KEY_PEM_BASE64 or LICENSE_PRIVATE_KEY_PEM."
    );
  }

  cachedConfig = Object.freeze({
    appBaseUrl: requireEnv("APP_BASE_URL").replace(/\/+$/g, ""),
    internalApiKey: optionalEnv("INTERNAL_API_KEY"),
    telegram: Object.freeze({
      botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
      botUsername: optionalEnv("TELEGRAM_BOT_USERNAME"),
      webhookSecret: optionalEnv("TELEGRAM_WEBHOOK_SECRET"),
    }),
    supabase: Object.freeze({
      url: requireEnv("SUPABASE_URL"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    paystack: Object.freeze({
      secretKey: requireEnv("PAYSTACK_SECRET_KEY"),
      callbackUrl: optionalEnv("PAYSTACK_CALLBACK_URL"),
    }),
    license: Object.freeze({
      privateKeyPem,
      productId: optionalEnv("BEASON_LICENSE_PRODUCT_ID", "BEASON_CBT_PRO"),
      productCode: optionalEnv("BEASON_LICENSE_PRODUCT_CODE", "BCP"),
      kind: optionalEnv("LICENSE_KIND", "standard") || "standard",
      durationDays: asInteger(process.env.LICENSE_DURATION_DAYS, 365),
      priceKobo: asInteger(process.env.LICENSE_PRICE_KOBO, 500000),
      currency: optionalEnv("LICENSE_CURRENCY", "NGN").toUpperCase(),
      discountCouponCode: optionalEnv("DISCOUNT_COUPON_CODE", "bison_owns_beason").toLowerCase(),
      discountCouponPercent: asInteger(process.env.DISCOUNT_COUPON_PERCENT, 50),
    }),
  });

  return cachedConfig;
}

module.exports = {
  getConfig,
};
