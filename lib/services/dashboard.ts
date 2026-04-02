import { supabaseAdmin } from "@/lib/supabase/server";

export async function getDashboardOverview() {
  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    revokedKeys,
    tempKeys,
    standardKeys,
    approvedHelpers,
    pendingHelpers,
  ] = await Promise.all([
    countRows("license_keys"),
    countRows("license_keys", { status: "active" }),
    countRows("license_keys", { status: "expired" }),
    countRows("license_keys", { status: "revoked" }),
    countRows("license_keys", { key_type: "temp" }),
    countRows("license_keys", { key_type: "standard" }),
    countRows("helpers", { approval_status: "approved" }),
    countRows("helpers", { approval_status: "pending" }),
  ]);

  return {
    totalKeys,
    activeKeys,
    expiredKeys,
    revokedKeys,
    tempKeys,
    standardKeys,
    approvedHelpers,
    pendingHelpers,
  };
}

async function countRows(table: string, filters?: Record<string, string>) {
  let query = supabaseAdmin.from(table).select("id", { count: "exact" }).limit(1);

  for (const [column, value] of Object.entries(filters ?? {})) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

export async function getHelperTableData() {
  const { data, error } = await supabaseAdmin.rpc("get_helper_generation_stats");

  if (!error && data) {
    return data as Array<Record<string, unknown>>;
  }

  const { data: helpers, error: helperError } = await supabaseAdmin
    .from("helpers")
    .select("id, full_name, telegram_username, approval_status, created_at");

  if (helperError) {
    throw new Error(`Failed to load helper table: ${helperError.message}`);
  }

  const helperIds = helpers.map((helper) => helper.id);
  const { data: keys, error: keyError } = await supabaseAdmin
    .from("license_keys")
    .select("generated_by_helper_id, key_type, generated_at")
    .in("generated_by_helper_id", helperIds.length > 0 ? helperIds : ["00000000-0000-0000-0000-000000000000"]);

  if (keyError) {
    throw new Error(`Failed to load helper key data: ${keyError.message}`);
  }

  return helpers.map((helper) => {
    const rows = keys.filter((key) => key.generated_by_helper_id === helper.id);
    return {
      id: helper.id,
      full_name: helper.full_name,
      telegram_username: helper.telegram_username,
      status: helper.approval_status,
      total_generated: rows.length,
      temp_count: rows.filter((row) => row.key_type === "temp").length,
      standard_count: rows.filter((row) => row.key_type === "standard").length,
      last_generated_time: rows[0]?.generated_at ?? null,
    };
  });
}

export async function getLicenseTableData(filters: {
  helperId?: string;
  keyType?: string;
  status?: string;
  hwid?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  let query = supabaseAdmin
    .from("license_keys")
    .select("*, helpers(full_name, telegram_username)")
    .order("generated_at", { ascending: false })
    .limit(100);

  if (filters.helperId) {
    query = query.eq("generated_by_helper_id", filters.helperId);
  }

  if (filters.keyType) {
    query = query.eq("key_type", filters.keyType);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.hwid) {
    query = query.ilike("hwid", `%${filters.hwid}%`);
  }

  if (filters.dateFrom) {
    query = query.gte("generated_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("generated_at", filters.dateTo);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load licenses: ${error.message}`);
  }

  return data;
}

export async function getHelperDetailData(helperId: string) {
  const [{ data: helper, error: helperError }, { data: licenses, error: licenseError }] =
    await Promise.all([
      supabaseAdmin.from("helpers").select("*").eq("id", helperId).single(),
      supabaseAdmin
        .from("license_keys")
        .select("*")
        .eq("generated_by_helper_id", helperId)
        .order("generated_at", { ascending: false })
        .limit(50),
    ]);

  if (helperError) {
    throw new Error(`Failed to load helper detail: ${helperError.message}`);
  }

  if (licenseError) {
    throw new Error(`Failed to load helper licenses: ${licenseError.message}`);
  }

  return {
    helper,
    licenses,
  };
}
