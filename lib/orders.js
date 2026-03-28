"use strict";

const crypto = require("crypto");
const { getConfig } = require("./config");
const { getSupabaseAdmin, unwrapSingle } = require("./supabase");
const { initializeTransaction, verifyTransaction } = require("./paystack");
const { generateLicenseKey, normalizeHwid } = require("./license");
const { sendTelegramMessage } = require("./telegram");
const logger = require("./logger");

const ORDER_STATUS = Object.freeze({
  pendingPayment: "pending_payment",
  paid: "paid",
  delivered: "delivered",
  paymentMismatch: "payment_mismatch",
});

function normalizeCouponInput(value) {
  return String(value || "").trim().toLowerCase();
}

function formatAmountNaira(amountKobo) {
  return `NGN ${(Number(amountKobo || 0) / 100).toFixed(2)}`;
}

function getCouponPricing(couponCode) {
  const config = getConfig();
  const originalAmountKobo = config.license.priceKobo;
  const normalizedCoupon = normalizeCouponInput(couponCode);
  const validCoupon = config.license.discountCouponCode;
  const discountPercent =
    normalizedCoupon && normalizedCoupon === validCoupon ? config.license.discountCouponPercent : 0;
  const finalAmountKobo = Math.round(originalAmountKobo * (100 - discountPercent) / 100);

  return {
    couponCode: discountPercent > 0 ? validCoupon : null,
    discountPercent,
    originalAmountKobo,
    finalAmountKobo,
  };
}

function createOrderCode() {
  return `BEASON-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function upsertBuyer({ telegramUserId, telegramUsername, fullName, email }) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("buyers")
    .upsert(
      {
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername || null,
        full_name: fullName,
        email,
      },
      {
        onConflict: "telegram_user_id",
      }
    )
    .select()
    .single();

  return unwrapSingle(result, "Buyer upsert failed.");
}

async function getBotState(telegramUserId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bot_state")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || { telegram_user_id: telegramUserId, state: "idle", data: {} };
}

async function setBotState(telegramUserId, state, data = {}) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bot_state")
    .upsert(
      {
        telegram_user_id: telegramUserId,
        state,
        data,
      },
      {
        onConflict: "telegram_user_id",
      }
    )
    .select()
    .single();

  return unwrapSingle(result, "Could not persist bot state.");
}

async function clearBotState(telegramUserId) {
  return setBotState(telegramUserId, "idle", {});
}

async function getPendingOrderByTelegramUser(telegramUserId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("orders")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .in("status", [ORDER_STATUS.pendingPayment])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function findReusablePendingOrder(telegramUserId, hwid) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("orders")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("hwid", normalizeHwid(hwid))
    .in("status", [ORDER_STATUS.pendingPayment])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function getOrderByCode(orderCode) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("orders")
    .select("*")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function getOrderByReference(reference) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("orders")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function updateOrder(orderId, patch) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select()
    .single();

  return unwrapSingle(result, "Order update failed.");
}

async function getLicenseByOrderId(orderId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("licenses")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function getLatestLicenseForTelegramUser(telegramUserId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("licenses")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data || null;
}

async function createLicenseRecord({ order, buyerId, licenseKey, payload, hwid, kind, expiresAt }) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("licenses")
    .insert({
      order_id: order.id,
      buyer_id: buyerId,
      telegram_user_id: order.telegram_user_id,
      hwid,
      kind,
      expires_at: expiresAt,
      license_key: licenseKey,
      payload,
      delivered_at: new Date().toISOString(),
    })
    .select()
    .single();

  return unwrapSingle(result, "License insert failed.");
}

async function createPaymentForOrderInput({ telegramUserId, telegramUsername, fullName, email, hwid, couponCode }) {
  const config = getConfig();
  const normalizedHwid = normalizeHwid(hwid);
  const existing = await findReusablePendingOrder(telegramUserId, normalizedHwid);
  if (existing && existing.paystack_authorization_url) {
    return {
      reused: true,
      order: existing,
      paymentUrl: existing.paystack_authorization_url,
    };
  }

  const pendingForUser = await getPendingOrderByTelegramUser(telegramUserId);
  if (pendingForUser && pendingForUser.paystack_authorization_url) {
    return {
      reused: true,
      order: pendingForUser,
      paymentUrl: pendingForUser.paystack_authorization_url,
    };
  }

  const pricing = getCouponPricing(couponCode);

  const buyer = await upsertBuyer({
    telegramUserId,
    telegramUsername,
    fullName,
    email,
  });

  const orderCode = createOrderCode();
  const reference = orderCode;
  const supabase = getSupabaseAdmin();

  const orderInsert = await supabase
    .from("orders")
    .insert({
      order_code: orderCode,
      buyer_id: buyer.id,
      telegram_user_id: telegramUserId,
      hwid: normalizedHwid,
      email,
      amount_kobo: pricing.finalAmountKobo,
      currency: config.license.currency,
      status: ORDER_STATUS.pendingPayment,
      paystack_reference: reference,
      metadata: {
        duration_days: config.license.durationDays,
        kind: config.license.kind,
        coupon_code: pricing.couponCode,
        discount_percent: pricing.discountPercent,
        original_amount_kobo: pricing.originalAmountKobo,
        final_amount_kobo: pricing.finalAmountKobo,
      },
    })
    .select()
    .single();

  const order = unwrapSingle(orderInsert, "Order creation failed.");

  const payment = await initializeTransaction({
    email,
    amountKobo: pricing.finalAmountKobo,
    reference,
    metadata: {
      order_code: orderCode,
      telegram_user_id: telegramUserId,
      hwid: normalizedHwid,
      coupon_code: pricing.couponCode,
      discount_percent: pricing.discountPercent,
      original_amount_kobo: pricing.originalAmountKobo,
      final_amount_kobo: pricing.finalAmountKobo,
    },
  });

  const updatedOrder = await updateOrder(order.id, {
    paystack_access_code: payment.access_code,
    paystack_authorization_url: payment.authorization_url,
  });

  logger.info("payment_initialized", {
    orderCode,
    telegramUserId,
    hwid: normalizedHwid,
  });

  return {
    reused: false,
    buyer,
    order: updatedOrder,
    paymentUrl: payment.authorization_url,
  };
}

async function deliverLicenseMessage(license, order) {
  const text = [
    "Payment confirmed for BEASON CBT.",
    "",
    `Order: ${order.order_code}`,
    `HWID: ${license.hwid}`,
    `Expires: ${license.expires_at ? new Date(license.expires_at).toISOString() : "No expiry"}`,
    "",
    "Your activation key:",
    license.license_key,
    "",
    "Paste this key into the BEASON activation screen on the same device HWID.",
  ].join("\n");

  await sendTelegramMessage(order.telegram_user_id, text);
}

async function issueLicenseForPaidOrder(order) {
  const existingLicense = await getLicenseByOrderId(order.id);
  if (existingLicense) {
    return existingLicense;
  }

  const config = getConfig();
  const durationDays = Number(order.metadata?.duration_days || config.license.durationDays);
  const kind = String(order.metadata?.kind || config.license.kind || "standard");

  const generated = generateLicenseKey({
    hwid: order.hwid,
    kind,
    durationDays,
  });

  const expiresAt = new Date(generated.expiresUnix * 1000).toISOString();
  const license = await createLicenseRecord({
    order,
    buyerId: order.buyer_id,
    licenseKey: generated.licenseKey,
    payload: generated.payload,
    hwid: generated.hwid,
    kind: generated.payload.k,
    expiresAt,
  });

  await updateOrder(order.id, {
    status: ORDER_STATUS.delivered,
  });

  await deliverLicenseMessage(license, order);

  logger.info("license_issued", {
    orderCode: order.order_code,
    telegramUserId: order.telegram_user_id,
    hwid: order.hwid,
  });

  return license;
}

async function confirmOrderPayment({ reference }) {
  const config = getConfig();
  const verified = await verifyTransaction(reference);
  const metadata = verified.metadata || {};
  const orderCode = String(metadata.order_code || "").trim();
  const order = (orderCode && (await getOrderByCode(orderCode))) || (await getOrderByReference(reference));

  if (!order) {
    throw new Error(`No order found for reference ${reference}.`);
  }

  if (verified.status !== "success") {
    return {
      ok: false,
      order,
      verified,
      reason: `Transaction status is ${verified.status}.`,
    };
  }

  const paidAmount = Number(verified.amount || 0);
  const paidCurrency = String(verified.currency || "").toUpperCase();
  const expectedHwid = String(metadata.hwid || "").trim().toUpperCase();

  if (paidAmount !== Number(order.amount_kobo) || paidCurrency !== config.license.currency) {
    await updateOrder(order.id, {
      status: ORDER_STATUS.paymentMismatch,
      paystack_verified_at: new Date().toISOString(),
    });
    throw new Error("Verified payment does not match expected order amount or currency.");
  }

  if (expectedHwid && expectedHwid !== String(order.hwid || "").toUpperCase()) {
    await updateOrder(order.id, {
      status: ORDER_STATUS.paymentMismatch,
      paystack_verified_at: new Date().toISOString(),
    });
    throw new Error("Verified payment HWID metadata does not match the stored order HWID.");
  }

  const paidAt = verified.paid_at || new Date().toISOString();
  const updatedOrder = await updateOrder(order.id, {
    status: ORDER_STATUS.paid,
    paystack_paid_at: paidAt,
    paystack_verified_at: new Date().toISOString(),
  });

  const license = await issueLicenseForPaidOrder(updatedOrder);
  return {
    ok: true,
    order: updatedOrder,
    verified,
    license,
  };
}

module.exports = {
  ORDER_STATUS,
  formatAmountNaira,
  getCouponPricing,
  getBotState,
  setBotState,
  clearBotState,
  getPendingOrderByTelegramUser,
  getLatestLicenseForTelegramUser,
  createPaymentForOrderInput,
  confirmOrderPayment,
  getOrderByCode,
};
