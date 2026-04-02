import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit";
import { ApprovalStatus, Helper, HelperRole } from "@/lib/types";

type TelegramIdentity = {
  telegramUserId: number;
  username?: string | null;
  fullName: string;
};

async function getHelperByTelegramId(telegramUserId: number) {
  const { data, error } = await supabaseAdmin
    .from("helpers")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle<Helper>();

  if (error) {
    throw new Error(`Failed to fetch helper: ${error.message}`);
  }

  return data;
}

export async function getHelperById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("helpers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Helper>();

  if (error) {
    throw new Error(`Failed to fetch helper: ${error.message}`);
  }

  return data;
}

export async function getOrCreateHelper(identity: TelegramIdentity) {
  const existing = await getHelperByTelegramId(identity.telegramUserId);
  if (existing) {
    return existing;
  }

  const role: HelperRole =
    identity.telegramUserId === Number(env.TELEGRAM_SUPER_ADMIN_ID) ? "super_admin" : "helper";
  const approvalStatus: ApprovalStatus = role === "super_admin" ? "approved" : "pending";

  const { data, error } = await supabaseAdmin
    .from("helpers")
    .insert({
      telegram_user_id: identity.telegramUserId,
      telegram_username: identity.username ?? null,
      full_name: identity.fullName,
      role,
      approval_status: approvalStatus,
      approved_at: approvalStatus === "approved" ? new Date().toISOString() : null,
    })
    .select("*")
    .single<Helper>();

  if (error) {
    throw new Error(`Failed to create helper: ${error.message}`);
  }

  await logAuditEvent({
    actorType: "telegram_user",
    actorId: String(identity.telegramUserId),
    action: "helper_registered",
    targetType: "helper",
    targetId: data.id,
    metadata: {
      username: identity.username ?? null,
      fullName: identity.fullName,
      role,
      approvalStatus,
    },
  });

  return data;
}

export async function updateHelperStatus({
  helperId,
  actorId,
  nextStatus,
  role,
}: {
  helperId: string;
  actorId: string;
  nextStatus: ApprovalStatus;
  role?: HelperRole;
}) {
  const payload: Record<string, unknown> = {
    approval_status: nextStatus,
  };

  if (nextStatus === "approved") {
    payload.approved_at = new Date().toISOString();
    payload.approved_by = actorId;
  }

  if (role) {
    payload.role = role;
  }

  const { data, error } = await supabaseAdmin
    .from("helpers")
    .update(payload)
    .eq("id", helperId)
    .select("*")
    .single<Helper>();

  if (error) {
    throw new Error(`Failed to update helper: ${error.message}`);
  }

  await logAuditEvent({
    actorType: "helper",
    actorId,
    action: `helper_${nextStatus}`,
    targetType: "helper",
    targetId: helperId,
    metadata: {
      role: data.role,
      telegramUserId: data.telegram_user_id,
    },
  });

  return data;
}

export async function getPendingHelpers() {
  const { data, error } = await supabaseAdmin
    .from("helpers")
    .select("*")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true })
    .returns<Helper[]>();

  if (error) {
    throw new Error(`Failed to load pending helpers: ${error.message}`);
  }

  return data;
}

export async function requireApprovedGenerator(telegramUserId: number) {
  const helper = await getHelperByTelegramId(telegramUserId);

  if (!helper) {
    throw new Error("Helper account not found.");
  }

  if (helper.approval_status !== "approved") {
    throw new Error(`Account is ${helper.approval_status}.`);
  }

  return helper;
}

export async function searchHelpers(term: string) {
  const normalized = term.trim();

  const { data, error } = await supabaseAdmin
    .from("helpers")
    .select("*")
    .or(
      [
        `full_name.ilike.%${normalized}%`,
        `telegram_username.ilike.%${normalized}%`,
        `telegram_user_id.eq.${Number(normalized) || -1}`,
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Helper[]>();

  if (error) {
    throw new Error(`Failed to search helpers: ${error.message}`);
  }

  return data;
}
