export function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="status-pill">
      <span className={`status-dot ${active ? "active" : ""}`} />
      {label}
    </div>
  );
}
