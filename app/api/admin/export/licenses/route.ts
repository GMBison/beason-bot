import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getLicenseTableData } from "@/lib/services/dashboard";

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
    .join(",");
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rows = await getLicenseTableData({});

  const csv = [
    toCsvRow([
      "record_id",
      "key_code",
      "product_code",
      "key_type",
      "duration_value",
      "duration_unit",
      "hwid",
      "generated_at",
      "status",
      "expires_at",
      "helper_name",
      "helper_username",
    ]),
    ...rows.map((row) =>
      toCsvRow([
        row.id,
        row.key_code,
        row.product_code,
        row.key_type,
        row.duration_value,
        row.duration_unit,
        row.hwid,
        row.generated_at,
        row.status,
        row.expires_at,
        row.helpers?.full_name,
        row.helpers?.telegram_username,
      ]),
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="beason-license-export.csv"',
    },
  });
}
