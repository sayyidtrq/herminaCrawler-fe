import type { ActionMessage } from "../lib/types";

export function PageHeader({
  eyebrow,
  title,
  helper,
  action,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-r from-[#172e25] to-[#3a5d46] text-white rounded-3xl p-8 mb-[10px] flex flex-col sm:flex-row sm:justify-between sm:items-center shadow-sm gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
        {helper ? <span className="text-sm font-medium text-emerald-100/70">{helper}</span> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
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
    <div className="section-header mb-6 border-b border-slate-100 pb-4">
      <div>
        <p className="kicker text-sm font-bold uppercase tracking-widest text-emerald-600 mb-1">{kicker}</p>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{title}</h2>
        {helper ? <span className="text-base text-slate-500 mt-2 block font-medium">{helper}</span> : null}
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
