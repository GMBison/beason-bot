export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="panel card">
      <p className="muted" style={{ margin: 0 }}>
        {label}
      </p>
      <p className="card-value">{value}</p>
    </article>
  );
}
