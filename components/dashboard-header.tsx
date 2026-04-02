import { logoutAction } from "@/app/dashboard/actions";

export function DashboardHeader() {
  return (
    <header className="panel dashboard-header">
      <div>
        <p className="muted" style={{ marginBottom: 8 }}>
          Telegram-controlled issuance with BEASON-compatible signing
        </p>
        <h1 className="display-title" style={{ marginBottom: 0 }}>
          Operations Dashboard
        </h1>
      </div>

      <form action={logoutAction}>
        <button className="button-secondary" type="submit">
          Logout
        </button>
      </form>
    </header>
  );
}
