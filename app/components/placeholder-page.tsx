import { AppShell } from "./app-shell";
import { PageHeader } from "./ui";

export function PlaceholderPage({
  moduleName,
  description,
}: {
  moduleName: string;
  description: string;
}) {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Roadmap Module"
        title={moduleName}
        helper={description}
      />
      <section className="panel page-panel">
        <p className="placeholder-copy">
          Modul ini sudah disiapkan sebagai route terpisah. Implementasi detailnya bisa kita lanjut setelah
          Locations dan Fetch Jobs stabil.
        </p>
      </section>
    </AppShell>
  );
}
