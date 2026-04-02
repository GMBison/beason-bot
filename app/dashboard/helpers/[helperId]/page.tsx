import Link from "next/link";
import { reactivateHelperAction, suspendHelperAction } from "@/app/dashboard/actions";
import { LicenseTable } from "@/components/license-table";
import { requireSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getHelperDetailData } from "@/lib/services/dashboard";

export default async function HelperDetailPage({
  params,
}: {
  params: Promise<{ helperId: string }>;
}) {
  await requireSession();
  const { helperId } = await params;
  const { helper, licenses } = await getHelperDetailData(helperId);
  const suspended = helper.approval_status === "suspended";

  return (
    <main className="shell dashboard-shell">
      <div className="inline-actions">
        <Link className="button-secondary" href="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      <section className="panel section">
        <h1 className="display-title" style={{ marginBottom: 8 }}>
          {helper.full_name}
        </h1>
        <div className="helper-grid">
          <div className="stack">
            <p className="muted">Telegram username</p>
            <strong>@{helper.telegram_username ?? "unknown"}</strong>
            <p className="muted">Telegram ID</p>
            <strong>{helper.telegram_user_id}</strong>
            <p className="muted">Role</p>
            <strong>{helper.role}</strong>
          </div>

          <div className="stack">
            <p className="muted">Status</p>
            <span className={`badge ${helper.approval_status}`}>{helper.approval_status}</span>
            <p className="muted">Created</p>
            <strong>{formatDate(helper.created_at)}</strong>
            <p className="muted">Approved</p>
            <strong>{formatDate(helper.approved_at)}</strong>
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 24 }}>
          {suspended ? (
            <form action={reactivateHelperAction}>
              <input name="helperId" type="hidden" value={helper.id} />
              <button className="button" type="submit">
                Reactivate Helper
              </button>
            </form>
          ) : (
            <form action={suspendHelperAction}>
              <input name="helperId" type="hidden" value={helper.id} />
              <button className="button-danger" type="submit">
                Suspend Helper
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="panel section">
        <h2>Generated Licenses</h2>
        <LicenseTable rows={licenses as never[]} />
      </section>
    </main>
  );
}
