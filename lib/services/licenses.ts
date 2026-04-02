import { env } from "@/lib/env";
import { generateBeasonLicense } from "@/lib/beason/issuer";
import { logAuditEvent } from "@/lib/services/audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Helper, KeyType, LicenseKeyRecord } from "@/lib/types";

export async function createLicenseKey({
  helper,
  keyType,
  durationValue,
  durationUnit,
  hwid,
}: {
  helper: Helper;
  keyType: KeyType;
  durationValue: number;
  durationUnit: "hours" | "days" | "months" | "years";
  hwid: string;
}) {
  const issued = await generateBeasonLicense({
    productCode: env.BEASON_PRODUCT_CODE,
    keyType,
    durationValue,
    durationUnit,
    hwid,
    generatedBy: {
      helperId: helper.id,
      telegramUserId: helper.telegram_user_id,
      name: helper.full_name,
    },
  });

  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .insert({
      key_code: issued.keyCode,
      signed_payload: issued.signedPayload,
      product_code: env.BEASON_PRODUCT_CODE,
      key_type: keyType,
      duration_value: durationValue,
      duration_unit: durationUnit,
      hwid,
      generated_by_helper_id: helper.id,
      generated_at: new Date().toISOString(),
      status: "unused",
      expires_at: issued.expiresAt,
    })
    .select("*")
    .single<LicenseKeyRecord>();

  if (error) {
    throw new Error(`Failed to store generated license: ${error.message}`);
  }

  await logAuditEvent({
    actorType: "helper",
    actorId: helper.id,
    action: "license_generated",
    targetType: "license_key",
    targetId: data.id,
    metadata: {
      keyType,
      durationValue,
      durationUnit,
      hwid,
      productCode: data.product_code,
      expiresAt: data.expires_at,
    },
  });

  return data;
}

export async function listGeneratedKeysForHelper(helperId: string) {
  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .select("*")
    .eq("generated_by_helper_id", helperId)
    .order("generated_at", { ascending: false })
    .limit(10)
    .returns<LicenseKeyRecord[]>();

  if (error) {
    throw new Error(`Failed to list generated keys: ${error.message}`);
  }

  return data;
}

export async function findLicenseByCodeOrId(term: string) {
  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .select("*")
    .or(`id.eq.${term},key_code.eq.${term}`)
    .maybeSingle<LicenseKeyRecord>();

  if (error) {
    throw new Error(`Failed to find key: ${error.message}`);
  }

  return data;
}

export async function findLicensesByHwid(hwid: string) {
  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .select("*")
    .ilike("hwid", `%${hwid}%`)
    .order("generated_at", { ascending: false })
    .limit(20)
    .returns<LicenseKeyRecord[]>();

  if (error) {
    throw new Error(`Failed to search keys by HWID: ${error.message}`);
  }

  return data;
}

export async function revokeLicenseKey({
  actorId,
  licenseId,
  reason,
}: {
  actorId: string;
  licenseId: string;
  reason?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .update({
      status: "revoked",
      notes: reason ?? "Revoked by admin",
    })
    .eq("id", licenseId)
    .select("*")
    .single<LicenseKeyRecord>();

  if (error) {
    throw new Error(`Failed to revoke key: ${error.message}`);
  }

  await logAuditEvent({
    actorType: "helper",
    actorId,
    action: "license_revoked",
    targetType: "license_key",
    targetId: licenseId,
    metadata: {
      reason: reason ?? null,
      keyCode: data.key_code,
    },
  });

  return data;
}
