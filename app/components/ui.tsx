import type { ActionMessage } from "../lib/types";

export function PageHeader({
  eyebrow,
  title,
  helper,
  action,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <span>{helper}</span>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  kicker,
  title,
  helper,
  action,
}: {
  kicker: string;
  title: string;
  helper?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        {helper ? <span>{helper}</span> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "positive" | "danger" | "warning" | "info" | "critical" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function BackendWarning({ error }: { error: string }) {
  return (
    <section className="warning-panel" role="alert">
      <div>
        <strong>Backend belum terhubung.</strong>
        <p>UI ini tidak memakai mock/fallback data. Jalankan FastAPI dulu, lalu refresh halaman.</p>
      </div>
      <code>python -m uvicorn apps.api.main:app --reload --port 8000</code>
      <small>Detail error: {error}</small>
    </section>
  );
}

export function ActionMessagePanel({ message }: { message: ActionMessage | null }) {
  if (!message) return null;

  return (
    <section className={`action-message ${message.type}`}>
      <div>
        <strong>{message.title}</strong>
        <span>{message.type === "info" ? "Processing" : "Backend response"}</span>
      </div>
      <pre>{message.detail}</pre>
    </section>
  );
}
