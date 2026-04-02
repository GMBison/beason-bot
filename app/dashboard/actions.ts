"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { logAuditEvent } from "@/lib/services/audit";
import { updateHelperStatus } from "@/lib/services/helpers";
import { revokeLicenseKey } from "@/lib/services/licenses";
import { sendTelegramMessage } from "@/lib/telegram/client";

const WEB_ACTOR_ID = "web-admin";

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function revokeLicenseAction(formData: FormData) {
  const licenseId = String(formData.get("licenseId") ?? "");
  if (!licenseId) return;

  const revoked = await revokeLicenseKey({
    actorId: WEB_ACTOR_ID,
    licenseId,
    reason: "Revoked from admin dashboard",
  });

  await sendTelegramMessage(
    env.TELEGRAM_NOTIFICATION_CHAT_ID,
    [
      "<b>License revoked</b>",
      "By: web admin dashboard",
      `Record ID: ${revoked.id}`,
      `Key: ${revoked.key_code}`,
      `Reason: ${revoked.notes ?? "N/A"}`,
    ].join("\n"),
  );

  revalidatePath("/dashboard");
}

export async function suspendHelperAction(formData: FormData) {
  const helperId = String(formData.get("helperId") ?? "");
  if (!helperId) return;

  await updateHelperStatus({
    helperId,
    actorId: WEB_ACTOR_ID,
    nextStatus: "suspended",
  });

  await logAuditEvent({
    actorType: "web_admin",
    actorId: WEB_ACTOR_ID,
    action: "helper_suspended_via_dashboard",
    targetType: "helper",
    targetId: helperId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/helpers/${helperId}`);
}

export async function reactivateHelperAction(formData: FormData) {
  const helperId = String(formData.get("helperId") ?? "");
  if (!helperId) return;

  await updateHelperStatus({
    helperId,
    actorId: WEB_ACTOR_ID,
    nextStatus: "approved",
  });

  await logAuditEvent({
    actorType: "web_admin",
    actorId: WEB_ACTOR_ID,
    action: "helper_reactivated_via_dashboard",
    targetType: "helper",
    targetId: helperId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/helpers/${helperId}`);
}
