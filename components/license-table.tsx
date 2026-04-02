import { revokeLicenseAction } from "@/app/dashboard/actions";
import { formatDate, truncate } from "@/lib/format";

type LicenseTableRow = {
  id: string;
  key_code: string;
  key_type: string;
  duration_value: number;
  duration_unit: string;
  hwid: string;
  generated_at: string;
  expires_at: string;
  status: string;
  helpers?: {
    full_name?: string | null;
    telegram_username?: string | null;
  } | null;
};

export function LicenseTable({ rows }: { rows: LicenseTableRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Helper</th>
            <th>Type</th>
            <th>Duration</th>
            <th>HWID</th>
            <th>Generated</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td title={row.key_code}>{truncate(row.key_code, 24)}</td>
              <td>{row.helpers?.full_name ?? "Unknown"}</td>
              <td>
                <span className={`badge ${row.key_type}`}>{row.key_type}</span>
              </td>
              <td>
                {row.duration_value} {row.duration_unit}
              </td>
              <td>{truncate(row.hwid, 18)}</td>
              <td>{formatDate(row.generated_at)}</td>
              <td>{formatDate(row.expires_at)}</td>
              <td>
                <span className={`badge ${row.status}`}>{row.status}</span>
              </td>
              <td>
                <form action={revokeLicenseAction}>
                  <input name="licenseId" type="hidden" value={row.id} />
                  <button className="button-danger" type="submit" disabled={row.status === "revoked"}>
                    Revoke
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
