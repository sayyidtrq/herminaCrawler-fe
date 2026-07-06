import Link from "next/link";
import { AppShell } from "../components/app-shell";
import { SectionHeader } from "../components/ui";

export default async function OneboxPrMockPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; review_id?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "assign" ? "Assign PIC" : "Buat Action";

  return (
    <AppShell>
      <section className="panel page-panel onebox-mock-page">
        <SectionHeader
          kicker="Onebox PR Mock"
          title={mode}
          helper="Placeholder sementara sampai redirect Onebox PR asli tersedia."
        />
        <div className="onebox-mock-card">
          <span>Review ID</span>
          <strong>{params.review_id ?? "Belum ada"}</strong>
          <p>Data tindak lanjut di dashboard saat ini masih dummy untuk preview flow manajemen.</p>
          <Link href="/dashboard">Kembali ke Dashboard</Link>
        </div>
      </section>
    </AppShell>
  );
}
