"use strict";

const { sendTelegramMessage } = require("./telegram");
const { normalizeHwid } = require("./license");
const {
  getBotState,
  setBotState,
  clearBotState,
  getLatestLicenseForTelegramUser,
  getPendingOrderByTelegramUser,
  createPaymentForOrderInput,
  confirmOrderPayment,
} = require("./orders");
const logger = require("./logger");

function isYes(text) {
  return /^(yes|y|confirm)$/i.test(String(text || "").trim());
}

function isNo(text) {
  return /^(no|n|edit|change)$/i.test(String(text || "").trim());
}

function formatSummary(data) {
  return [
    "Please confirm your BEASON CBT order:",
    `Full name: ${data.full_name}`,
    `Email: ${data.email}`,
    `HWID: ${data.hwid}`,
    "",
    "Reply YES to create your payment link, or NO to start over from the HWID step.",
  ].join("\n");
}

async function handleCommand(chatId, from, text) {
  const command = String(text || "").trim().split(/\s+/g)[0].toLowerCase();

  if (command === "/start") {
    await clearBotState(from.id);
    await sendTelegramMessage(
      chatId,
      [
        "BEASON CBT License Bot",
        "",
        "Commands:",
        "/buy - start a new license order",
        "/mykey - retrieve your latest paid activation key",
        "/checkpayment - verify your latest pending payment",
        "/help - show support information",
      ].join("\n")
    );
    return true;
  }

  if (command === "/help") {
    await sendTelegramMessage(
      chatId,
      [
        "How this works:",
        "1. Use /buy",
        "2. Send your full name, email, and BEASON HWID",
        "3. Pay with Paystack",
        "4. Receive your exact device-bound activation key instantly",
        "",
        "Use /checkpayment if payment is delayed.",
        "Use /mykey to retrieve your latest delivered key.",
      ].join("\n")
    );
    return true;
  }

  if (command === "/buy") {
    await setBotState(from.id, "awaiting_full_name", {});
    await sendTelegramMessage(chatId, "Send your full name exactly as you want it attached to this order.");
    return true;
  }

  if (command === "/mykey") {
    const latest = await getLatestLicenseForTelegramUser(from.id);
    if (!latest) {
      await sendTelegramMessage(chatId, "No paid BEASON activation key has been found for your Telegram account yet.");
      return true;
    }

    await sendTelegramMessage(
      chatId,
      [
        "Latest BEASON CBT activation key:",
        "",
        `HWID: ${latest.hwid}`,
        `Kind: ${latest.kind}`,
        `Expires: ${latest.expires_at ? new Date(latest.expires_at).toISOString() : "No expiry"}`,
        "",
        latest.license_key,
      ].join("\n")
    );
    return true;
  }

  if (command === "/checkpayment") {
    const pendingOrder = await getPendingOrderByTelegramUser(from.id);
    if (!pendingOrder) {
      await sendTelegramMessage(chatId, "No pending payment was found. Use /buy to create a new order.");
      return true;
    }

    try {
      const result = await confirmOrderPayment({ reference: pendingOrder.paystack_reference });
      if (!result.ok) {
        await sendTelegramMessage(
          chatId,
          `Payment is not confirmed yet for order ${pendingOrder.order_code}. Status: ${result.reason}`
        );
        return true;
      }

      await sendTelegramMessage(
        chatId,
        `Payment confirmed for order ${pendingOrder.order_code}. Your activation key has been delivered in this chat.`
      );
    } catch (error) {
      logger.warn("checkpayment_failed", {
        telegramUserId: from.id,
        orderCode: pendingOrder.order_code,
        error: error.message,
      });
      await sendTelegramMessage(
        chatId,
        `Payment is not confirmed yet for order ${pendingOrder.order_code}. If you paid moments ago, wait a bit and run /checkpayment again.`
      );
    }
    return true;
  }

  return false;
}

async function handleState(chatId, from, text, stateRecord) {
  const state = stateRecord.state || "idle";
  const data = stateRecord.data || {};
  const message = String(text || "").trim();

  if (state === "awaiting_full_name") {
    if (message.length < 3) {
      await sendTelegramMessage(chatId, "That full name looks too short. Please send your full name.");
      return;
    }
    await setBotState(from.id, "awaiting_email", {
      full_name: message,
    });
    await sendTelegramMessage(chatId, "Send the email address you want attached to this order.");
    return;
  }

  if (state === "awaiting_email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message)) {
      await sendTelegramMessage(chatId, "That email address is invalid. Send a valid email address.");
      return;
    }
    await setBotState(from.id, "awaiting_hwid", {
      ...data,
      email: message.toLowerCase(),
    });
    await sendTelegramMessage(chatId, "Send the BEASON HWID exactly as shown in the app.");
    return;
  }

  if (state === "awaiting_hwid") {
    let hwid;
    try {
      hwid = normalizeHwid(message);
    } catch (error) {
      await sendTelegramMessage(chatId, error.message);
      return;
    }

    await setBotState(from.id, "awaiting_hwid_confirm", {
      ...data,
      hwid,
    });
    await sendTelegramMessage(
      chatId,
      `Confirm this HWID:\n\n${hwid}\n\nReply YES to continue or NO to enter it again.`
    );
    return;
  }

  if (state === "awaiting_hwid_confirm") {
    if (isNo(message)) {
      await setBotState(from.id, "awaiting_hwid", {
        full_name: data.full_name,
        email: data.email,
      });
      await sendTelegramMessage(chatId, "Send the correct BEASON HWID.");
      return;
    }

    if (!isYes(message)) {
      await sendTelegramMessage(chatId, "Reply YES to confirm this HWID or NO to re-enter it.");
      return;
    }

    await setBotState(from.id, "awaiting_order_confirmation", data);
    await sendTelegramMessage(chatId, formatSummary(data));
    return;
  }

  if (state === "awaiting_order_confirmation") {
    if (isNo(message)) {
      await setBotState(from.id, "awaiting_hwid", {
        full_name: data.full_name,
        email: data.email,
      });
      await sendTelegramMessage(chatId, "Okay. Send the correct BEASON HWID.");
      return;
    }

    if (!isYes(message)) {
      await sendTelegramMessage(chatId, "Reply YES to create your payment link or NO to edit the HWID.");
      return;
    }

    const payment = await createPaymentForOrderInput({
      telegramUserId: from.id,
      telegramUsername: from.username || "",
      fullName: data.full_name,
      email: data.email,
      hwid: data.hwid,
    });

    await clearBotState(from.id);

    const lines = [
      payment.reused ? "You already have a pending unpaid order for this HWID." : "Your payment link is ready.",
      "",
      `Order: ${payment.order.order_code}`,
      `Amount: NGN ${(payment.order.amount_kobo / 100).toFixed(2)}`,
      `HWID: ${payment.order.hwid}`,
      "",
      "Pay here:",
      payment.paymentUrl,
      "",
      "After payment, wait a little for automatic delivery.",
      "If delivery is delayed, send /checkpayment.",
    ];

    const extra = payment.paymentUrl
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: "Pay Now", url: payment.paymentUrl }]],
          },
        }
      : {};

    await sendTelegramMessage(chatId, lines.join("\n"), extra);
    return;
  }

  await sendTelegramMessage(chatId, "Use /buy to start a new BEASON license order.");
}

async function handleTelegramUpdate(update) {
  const message = update.message;
  if (!message || !message.chat || !message.from) {
    return;
  }

  const chatId = message.chat.id;
  const from = message.from;
  const text = String(message.text || "").trim();
  if (!text) return;

  logger.info("telegram_update_received", {
    telegramUserId: from.id,
    text,
  });

  const handledCommand = text.startsWith("/") ? await handleCommand(chatId, from, text) : false;
  if (handledCommand) return;

  const stateRecord = await getBotState(from.id);
  await handleState(chatId, from, text, stateRecord);
}

function assertTelegramSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!secret) return true;
  const header = req.headers["x-telegram-bot-api-secret-token"];
  return String(header || "") === secret;
}

module.exports = {
  handleTelegramUpdate,
  assertTelegramSecret,
};
