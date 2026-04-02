import Link from "next/link";
import { formatDate } from "@/lib/format";

type HelperTableRow = {
  id: string;
  full_name: string;
  telegram_username: string | null;
  status: string;
  total_generated: number;
  temp_count: number;
  standard_count: number;
  last_generated_time: string | null;
};

export function HelperTable({ rows }: { rows: HelperTableRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Telegram</th>
            <th>Total</th>
            <th>Temp</th>
            <th>Standard</th>
            <th>Last Generated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/dashboard/helpers/${row.id}`}>{row.full_name}</Link>
              </td>
              <td>@{row.telegram_username ?? "unknown"}</td>
              <td>{row.total_generated}</td>
              <td>{row.temp_count}</td>
              <td>{row.standard_count}</td>
              <td>{formatDate(row.last_generated_time)}</td>
              <td>
                <span className={`badge ${row.status}`}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
