import { env } from "@/lib/env";
import { formatDate, truncate } from "@/lib/format";
import { logAuditEvent } from "@/lib/services/audit";
import { clearBotSession, getBotSession, upsertBotSession } from "@/lib/services/bot-sessions";
import {
  getOrCreateHelper,
  getPendingHelpers,
  requireApprovedGenerator,
  searchHelpers,
  updateHelperStatus,
} from "@/lib/services/helpers";
import {
  createLicenseKey,
  findLicenseByCodeOrId,
  findLicensesByHwid,
  listGeneratedKeysForHelper,
  revokeLicenseKey,
} from "@/lib/services/licenses";
import { getDashboardOverview } from "@/lib/services/dashboard";
import { sendTelegramMessage, answerCallbackQuery } from "@/lib/telegram/client";
import {
  adminMenuKeyboard,
  confirmKeyboard,
  durationKeyboard,
  helperApprovalKeyboard,
  helperManagementKeyboard,
  revokeKeyKeyboard,
  startKeyboard,
} from "@/lib/telegram/keyboards";
import { TelegramUpdate, TelegramUser } from "@/lib/telegram/types";
import { Helper, KeyType } from "@/lib/types";

function buildFullName(user: TelegramUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

function isAdmin(helper: Helper) {
  return helper.role === "super_admin" || helper.role === "admin";
}

async function notifySuperAdmin(text: string, keyboard?: Array<Array<{ text: string; callback_data: string }>>) {
  await sendTelegramMessage(env.TELEGRAM_NOTIFICATION_CHAT_ID, text, {
    inlineKeyboard: keyboard,
  });
}

async function sendStartMessage(chatId: number, helper: Helper) {
  const approved = helper.approval_status === "approved";
  const admin = isAdmin(helper);
  const statusLine =
    helper.approval_status === "approved"
      ? "Your account is approved."
      : `Your account is currently <b>${helper.approval_status}</b>.`;

  await sendTelegramMessage(
    chatId,
    [
      `<b>BEASON License Bot</b>`,
      statusLine,
      approved
        ? "Choose an action below."
        : "Use Request Access if you need approval from the super admin.",
    ].join("\n"),
    {
      inlineKeyboard: startKeyboard({ approved, isAdmin: admin }),
    },
  );
}

async function handleRequestAccess(user: TelegramUser, chatId: number) {
  const helper = await getOrCreateHelper({
    telegramUserId: user.id,
    username: user.username,
    fullName: buildFullName(user),
  });

  if (helper.approval_status === "approved") {
    await sendTelegramMessage(chatId, "Your access is already approved.");
    return;
  }

  await sendTelegramMessage(chatId, "Access request recorded. The super admin has been notified.");
  await notifySuperAdmin(
    [
      "<b>New helper access request</b>",
      `Name: ${helper.full_name}`,
      `Username: @${helper.telegram_username ?? "unknown"}`,
      `Telegram ID: ${helper.telegram_user_id}`,
      `Helper ID: ${helper.id}`,
      `Requested: ${formatDate(helper.created_at)}`,
    ].join("\n"),
    helperApprovalKeyboard(helper.id),
  );
}

async function handleGenerateStart(helper: Helper, chatId: number, keyType: KeyType) {
  try {
    await requireApprovedGenerator(helper.telegram_user_id);
  } catch {
    await logAuditEvent({
      actorType: "helper",
      actorId: helper.id,
      action: "unauthorized_generation_attempt",
      targetType: "license_request",
      targetId: helper.id,
      metadata: {
        keyType,
        status: helper.approval_status,
      },
    });

    await notifySuperAdmin(
      [
        "<b>Suspicious generation attempt</b>",
        `Helper: ${helper.full_name}`,
        `Telegram: @${helper.telegram_username ?? "unknown"} / ${helper.telegram_user_id}`,
        `Status: ${helper.approval_status}`,
        `Requested type: ${keyType}`,
      ].join("\n"),
    );

    await sendTelegramMessage(
      chatId,
      `You cannot generate keys while your account is ${helper.approval_status}.`,
    );
    return;
  }

  await upsertBotSession(helper.telegram_user_id, "generate", { keyType });
  await sendTelegramMessage(chatId, `Select the ${keyType} key duration.`, {
    inlineKeyboard: durationKeyboard(keyType),
  });
}

async function handleDurationSelection(
  helper: Helper,
  chatId: number,
  keyType: KeyType,
  durationValue: number,
  durationUnit: "hours" | "days" | "months" | "years",
) {
  await upsertBotSession(helper.telegram_user_id, "generate", {
    keyType,
    durationValue,
    durationUnit,
  });
  await sendTelegramMessage(chatId, "Send the customer HWID.");
}

async function handleTextMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const from = message.from;
  if (!from || !message.text) return;

  const helper = await getOrCreateHelper({
    telegramUserId: from.id,
    username: from.username,
    fullName: buildFullName(from),
  });
  const session = await getBotSession(from.id);
  const text = message.text.trim();

  if (text === "/start") {
    await clearBotSession(from.id);
    await sendStartMessage(message.chat.id, helper);
    return;
  }

  if (text === "/admin" && isAdmin(helper)) {
    await sendTelegramMessage(message.chat.id, "Admin menu", {
      inlineKeyboard: adminMenuKeyboard(),
    });
    return;
  }

  if (!session) {
    await sendStartMessage(message.chat.id, helper);
    return;
  }

  if (session.flow === "generate") {
    const state = session.state as {
      keyType?: KeyType;
      durationValue?: number;
      durationUnit?: "hours" | "days" | "months" | "years";
    };

    if (!state.keyType || !state.durationValue || !state.durationUnit) {
      await clearBotSession(from.id);
      await sendTelegramMessage(message.chat.id, "That generation session expired. Start again from the menu.");
      return;
    }

    await upsertBotSession(from.id, "generate", {
      ...state,
      hwid: text,
    });

    await sendTelegramMessage(
      message.chat.id,
      [
        "<b>Confirm key generation</b>",
        `Type: ${state.keyType}`,
        `Duration: ${state.durationValue} ${state.durationUnit}`,
        `HWID: ${text}`,
      ].join("\n"),
      { inlineKeyboard: confirmKeyboard() },
    );
    return;
  }

  if (session.flow === "check_key") {
    const license = await findLicenseByCodeOrId(text);
    await clearBotSession(from.id);

    if (!license) {
      await sendTelegramMessage(message.chat.id, "No key record matched that code or record ID.");
      return;
    }

    await sendTelegramMessage(
      message.chat.id,
      [
        "<b>Key status</b>",
        `Record ID: ${license.id}`,
        `Key: ${license.key_code}`,
        `Type: ${license.key_type}`,
        `HWID: ${license.hwid}`,
        `Status: ${license.status}`,
        `Generated: ${formatDate(license.generated_at)}`,
        `Expires: ${formatDate(license.expires_at)}`,
      ].join("\n"),
      { inlineKeyboard: isAdmin(helper) ? revokeKeyKeyboard(license.id) : undefined },
    );
    return;
  }

  if (session.flow === "admin_search_key" && isAdmin(helper)) {
    const license = await findLicenseByCodeOrId(text);
    await clearBotSession(from.id);

    if (!license) {
      await sendTelegramMessage(message.chat.id, "No key record matched that code or record ID.");
      return;
    }

    await sendTelegramMessage(
      message.chat.id,
      [
        "<b>Search result</b>",
        `Record ID: ${license.id}`,
        `Key: ${license.key_code}`,
        `Type: ${license.key_type}`,
        `HWID: ${license.hwid}`,
        `Status: ${license.status}`,
        `Generated: ${formatDate(license.generated_at)}`,
        `Expires: ${formatDate(license.expires_at)}`,
      ].join("\n"),
      { inlineKeyboard: revokeKeyKeyboard(license.id) },
    );
    return;
  }

  if (session.flow === "admin_search_hwid" && isAdmin(helper)) {
    const licenses = await findLicensesByHwid(text);
    await clearBotSession(from.id);

    if (licenses.length === 0) {
      await sendTelegramMessage(message.chat.id, "No keys matched that HWID.");
      return;
    }

    await sendTelegramMessage(
      message.chat.id,
      licenses
        .slice(0, 10)
        .map(
          (license) =>
            [
              `<b>${license.key_type.toUpperCase()}</b> ${license.status}`,
              `ID: ${license.id}`,
              `Key: ${truncate(license.key_code, 22)}`,
              `HWID: ${license.hwid}`,
              `Expires: ${formatDate(license.expires_at)}`,
            ].join("\n"),
        )
        .join("\n\n"),
    );
    return;
  }

  if (session.flow === "admin_search_helper" && isAdmin(helper)) {
    const helpers = await searchHelpers(text);
    await clearBotSession(from.id);

    if (helpers.length === 0) {
      await sendTelegramMessage(message.chat.id, "No helper matched that search.");
      return;
    }

    for (const result of helpers.slice(0, 10)) {
      await sendTelegramMessage(
        message.chat.id,
        [
          `<b>${result.full_name}</b>`,
          `Username: @${result.telegram_username ?? "unknown"}`,
          `Telegram ID: ${result.telegram_user_id}`,
          `Role: ${result.role}`,
          `Status: ${result.approval_status}`,
        ].join("\n"),
        {
          inlineKeyboard: helperManagementKeyboard(
            result.id,
            result.approval_status === "suspended",
          ),
        },
      );
    }
  }
}

async function handleConfirmGeneration(helper: Helper, chatId: number) {
  const session = await getBotSession(helper.telegram_user_id);
  const state = session?.state as {
    keyType?: KeyType;
    durationValue?: number;
    durationUnit?: "hours" | "days" | "months" | "years";
    hwid?: string;
  };

  if (!state?.keyType || !state.durationValue || !state.durationUnit || !state.hwid) {
    await clearBotSession(helper.telegram_user_id);
    await sendTelegramMessage(chatId, "The generation session is incomplete. Please start again.");
    return;
  }

  try {
    const license = await createLicenseKey({
      helper,
      keyType: state.keyType,
      durationValue: state.durationValue,
      durationUnit: state.durationUnit,
      hwid: state.hwid,
    });

    await clearBotSession(helper.telegram_user_id);
    await sendTelegramMessage(
      chatId,
      [
        "<b>License generated</b>",
        `Record ID: ${license.id}`,
        `Key: <code>${license.key_code}</code>`,
        `Expires: ${formatDate(license.expires_at)}`,
      ].join("\n"),
    );

    await notifySuperAdmin(
      [
        "<b>License generated</b>",
        `Helper: ${helper.full_name}`,
        `Telegram: @${helper.telegram_username ?? "unknown"} / ${helper.telegram_user_id}`,
        `Type: ${license.key_type}`,
        `Duration: ${license.duration_value} ${license.duration_unit}`,
        `HWID: ${license.hwid}`,
        `Generated: ${formatDate(license.generated_at)}`,
        `Key record ID: ${license.id}`,
      ].join("\n"),
    );
  } catch (error) {
    await notifySuperAdmin(
      [
        "<b>Failed generation attempt</b>",
        `Helper: ${helper.full_name}`,
        `Telegram ID: ${helper.telegram_user_id}`,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ].join("\n"),
    );
    throw error;
  }
}

async function handleAdminCallback(helper: Helper, chatId: number, parts: string[]) {
  const action = parts[1];

  if (action === "pending") {
    const pending = await getPendingHelpers();
    if (pending.length === 0) {
      await sendTelegramMessage(chatId, "No pending helpers right now.");
      return;
    }

    for (const candidate of pending) {
      await sendTelegramMessage(
        chatId,
        [
          `<b>${candidate.full_name}</b>`,
          `Username: @${candidate.telegram_username ?? "unknown"}`,
          `Telegram ID: ${candidate.telegram_user_id}`,
          `Requested: ${formatDate(candidate.created_at)}`,
        ].join("\n"),
        { inlineKeyboard: helperApprovalKeyboard(candidate.id) },
      );
    }
    return;
  }

  if (action === "search_key") {
    await upsertBotSession(helper.telegram_user_id, "admin_search_key", {});
    await sendTelegramMessage(chatId, "Send the key code or key record ID.");
    return;
  }

  if (action === "search_hwid") {
    await upsertBotSession(helper.telegram_user_id, "admin_search_hwid", {});
    await sendTelegramMessage(chatId, "Send the HWID to search.");
    return;
  }

  if (action === "search_helper") {
    await upsertBotSession(helper.telegram_user_id, "admin_search_helper", {});
    await sendTelegramMessage(chatId, "Send helper name, username, or Telegram ID.");
    return;
  }

  if (action === "stats") {
    const stats = await getDashboardOverview();
    await sendTelegramMessage(
      chatId,
      [
        "<b>BEASON stats</b>",
        `Total keys: ${stats.totalKeys}`,
        `Active keys: ${stats.activeKeys}`,
        `Expired keys: ${stats.expiredKeys}`,
        `Revoked keys: ${stats.revokedKeys}`,
        `Temp keys: ${stats.tempKeys}`,
        `Standard keys: ${stats.standardKeys}`,
        `Approved helpers: ${stats.approvedHelpers}`,
        `Pending helpers: ${stats.pendingHelpers}`,
      ].join("\n"),
    );
    return;
  }

  const targetId = parts[2];
  if (!targetId) return;

  if (action === "approve") {
    const updated = await updateHelperStatus({
      helperId: targetId,
      actorId: helper.id,
      nextStatus: "approved",
    });
    await sendTelegramMessage(chatId, `Approved ${updated.full_name}.`);
    await sendTelegramMessage(
      updated.telegram_user_id,
      "Your BEASON helper access has been approved. Use /start to begin generating keys.",
    );
    return;
  }

  if (action === "reject") {
    const updated = await updateHelperStatus({
      helperId: targetId,
      actorId: helper.id,
      nextStatus: "rejected",
    });
    await sendTelegramMessage(chatId, `Rejected ${updated.full_name}.`);
    await sendTelegramMessage(updated.telegram_user_id, "Your access request was rejected.");
    return;
  }

  if (action === "suspend") {
    const updated = await updateHelperStatus({
      helperId: targetId,
      actorId: helper.id,
      nextStatus: "suspended",
    });
    await sendTelegramMessage(chatId, `Suspended ${updated.full_name}.`);
    await sendTelegramMessage(updated.telegram_user_id, "Your BEASON helper access has been suspended.");
    return;
  }

  if (action === "reactivate") {
    const updated = await updateHelperStatus({
      helperId: targetId,
      actorId: helper.id,
      nextStatus: "approved",
    });
    await sendTelegramMessage(chatId, `Reactivated ${updated.full_name}.`);
    await sendTelegramMessage(updated.telegram_user_id, "Your BEASON helper access has been reactivated.");
    return;
  }

  if (action === "revoke") {
    const license = await revokeLicenseKey({
      actorId: helper.id,
      licenseId: targetId,
      reason: "Revoked from Telegram admin menu",
    });
    await sendTelegramMessage(chatId, `Revoked key ${license.key_code}.`);
    await notifySuperAdmin(
      [
        "<b>License revoked</b>",
        `By: ${helper.full_name}`,
        `Record ID: ${license.id}`,
        `Key: ${license.key_code}`,
        `Reason: ${license.notes ?? "N/A"}`,
      ].join("\n"),
    );
  }
}

async function handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate["callback_query"]>) {
  const user = callbackQuery.from;
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  const helper = await getOrCreateHelper({
    telegramUserId: user.id,
    username: user.username,
    fullName: buildFullName(user),
  });

  await answerCallbackQuery(callbackQuery.id);

  if (data === "request_access") {
    await handleRequestAccess(user, chatId);
    return;
  }

  if (data.startsWith("generate:")) {
    const [, keyType] = data.split(":");
    await handleGenerateStart(helper, chatId, keyType as KeyType);
    return;
  }

  if (data.startsWith("duration:")) {
    const [, keyType, value, unit] = data.split(":");
    await handleDurationSelection(
      helper,
      chatId,
      keyType as KeyType,
      Number(value),
      unit as "hours" | "days" | "months" | "years",
    );
    return;
  }

  if (data === "confirm_generation") {
    await handleConfirmGeneration(helper, chatId);
    return;
  }

  if (data === "cancel_flow") {
    await clearBotSession(helper.telegram_user_id);
    await sendTelegramMessage(chatId, "Flow cancelled.");
    return;
  }

  if (data === "my_keys") {
    const keys = await listGeneratedKeysForHelper(helper.id);
    if (keys.length === 0) {
      await sendTelegramMessage(chatId, "You have not generated any keys yet.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      keys
        .map(
          (license) =>
            [
              `<b>${license.key_type.toUpperCase()}</b> ${license.status}`,
              `ID: ${license.id}`,
              `Key: ${truncate(license.key_code, 22)}`,
              `HWID: ${license.hwid}`,
              `Generated: ${formatDate(license.generated_at)}`,
            ].join("\n"),
        )
        .join("\n\n"),
    );
    return;
  }

  if (data === "check_key") {
    await upsertBotSession(helper.telegram_user_id, "check_key", {});
    await sendTelegramMessage(chatId, "Send the key code or record ID to inspect.");
    return;
  }

  if (data === "admin_menu" && isAdmin(helper)) {
    await sendTelegramMessage(chatId, "Admin menu", {
      inlineKeyboard: adminMenuKeyboard(),
    });
    return;
  }

  if (data.startsWith("admin:") && isAdmin(helper)) {
    await handleAdminCallback(helper, chatId, data.split(":"));
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.message) {
    await handleTextMessage(update.message);
  }

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}
