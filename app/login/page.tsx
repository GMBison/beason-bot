import { loginAction } from "@/app/login/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell login-shell">
      <section className="panel login-card stack">
        <div>
          <p className="muted">Secure admin access</p>
          <h1 className="display-title">BEASON License Admin</h1>
          <p className="muted">
            Use your protected dashboard credentials to manage helpers, keys, and audit-ready
            records.
          </p>
        </div>

        <form action={loginAction} className="login-form">
          <label className="field">
            <span>Username</span>
            <input name="username" type="text" autoComplete="username" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          {params.error === "invalid" ? (
            <p className="muted" style={{ color: "var(--danger)" }}>
              Invalid credentials.
            </p>
          ) : null}

          <button className="button" type="submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  );
}
