import { DashboardHeader } from "@/components/dashboard-header";
import { HelperTable } from "@/components/helper-table";
import { LicenseTable } from "@/components/license-table";
import { StatCard } from "@/components/stat-card";
import { requireSession } from "@/lib/auth/session";
import { getDashboardOverview, getHelperTableData, getLicenseTableData } from "@/lib/services/dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const filters = await searchParams;
  const [overview, helperRows, licenseRows] = await Promise.all([
    getDashboardOverview(),
    getHelperTableData(),
    getLicenseTableData({
      helperId: typeof filters.helper === "string" ? filters.helper : undefined,
      keyType: typeof filters.type === "string" ? filters.type : undefined,
      status: typeof filters.status === "string" ? filters.status : undefined,
      hwid: typeof filters.hwid === "string" ? filters.hwid : undefined,
      dateFrom: typeof filters.dateFrom === "string" ? filters.dateFrom : undefined,
      dateTo: typeof filters.dateTo === "string" ? filters.dateTo : undefined,
    }),
  ]);

  return (
    <main className="shell dashboard-shell">
      <DashboardHeader />

      <section className="cards">
        <StatCard label="Total Keys" value={overview.totalKeys} />
        <StatCard label="Active Keys" value={overview.activeKeys} />
        <StatCard label="Expired Keys" value={overview.expiredKeys} />
        <StatCard label="Revoked Keys" value={overview.revokedKeys} />
        <StatCard label="Temp Keys" value={overview.tempKeys} />
        <StatCard label="Standard Keys" value={overview.standardKeys} />
        <StatCard label="Approved Helpers" value={overview.approvedHelpers} />
        <StatCard label="Pending Helpers" value={overview.pendingHelpers} />
      </section>

      <section className="grid-two">
        <article className="panel section">
          <h2>Helpers</h2>
          <p className="muted">Approval status and generation performance by helper.</p>
          <HelperTable rows={helperRows as never[]} />
        </article>

        <article className="panel section">
          <h2>License Filters</h2>
          <p className="muted">Filter up to the latest 100 records.</p>
          <form className="filters" method="get">
            <input name="helper" placeholder="Helper ID" defaultValue={String(filters.helper ?? "")} />
            <select name="type" defaultValue={String(filters.type ?? "")}>
              <option value="">All Types</option>
              <option value="temp">Temp</option>
              <option value="standard">Standard</option>
            </select>
            <select name="status" defaultValue={String(filters.status ?? "")}>
              <option value="">All Statuses</option>
              <option value="unused">Unused</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
            <input name="hwid" placeholder="HWID" defaultValue={String(filters.hwid ?? "")} />
            <input name="dateFrom" type="date" defaultValue={String(filters.dateFrom ?? "")} />
            <input name="dateTo" type="date" defaultValue={String(filters.dateTo ?? "")} />
            <button className="button" type="submit">
              Apply Filters
            </button>
            <a className="button-secondary" href="/api/admin/export/licenses">
              Export CSV
            </a>
          </form>
        </article>
      </section>

      <article className="panel section">
        <h2>Licenses</h2>
        <p className="muted">Generated BEASON-compatible license records.</p>
        <LicenseTable rows={licenseRows as never[]} />
      </article>
    </main>
  );
}
