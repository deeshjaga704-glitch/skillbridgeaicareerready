import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAuthenticatedVerificationRecords } from "@/lib/supabase/profile";
import type { VerificationRecord } from "@/lib/skillbridge-store";

export const Route = createFileRoute("/evidence")({
  head: () => ({
    meta: [
      { title: "Verified skill evidence — SkillBridge AI" },
      {
        name: "description",
        content: "Your authenticated verified skills and evidence records.",
      },
      { property: "og:title", content: "Verified skill evidence — SkillBridge AI" },
      { property: "og:description", content: "View the verified skills tied to your authenticated account." },
    ],
  }),
  component: EvidencePage,
});

function EvidencePage() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextRecords = await getAuthenticatedVerificationRecords();
        if (active) setRecords(nextRecords);
      } catch {
        if (active) setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Verified skill evidence</h1>
          <p className="max-w-2xl text-muted-foreground">
            Your latest authenticated verification records, one per skill, from the live Supabase data in your account.
          </p>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Loading your verified evidence…
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No verified skill evidence is available yet for this account.
          </div>
        ) : (
          <div className="grid gap-4">
            {records.map((record) => (
              <article key={record.id} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verified skill</p>
                    <h2 className="mt-1 font-display text-xl font-bold">{record.skillName}</h2>
                  </div>
                  <span
                    className={
                      record.outcome === "verified"
                        ? "rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                        : "rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground"
                    }
                  >
                    {record.outcome === "verified" ? "Verified" : record.outcome === "partial" ? "Partial" : "Not verified"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">{record.method}</span>
                  <span>{new Date(record.timestamp).toLocaleDateString()}</span>
                  {record.evidenceUrl ? (
                    <a href={record.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      View evidence <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                <p className="mt-4 text-sm text-muted-foreground">{record.evidenceSummary}</p>
                {record.reason ? <p className="mt-2 text-sm">{record.reason}</p> : null}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {record.signals.filter((signal) => signal.outcome === "pass").length} checks passed
                  </div>

                  <Link to="/v/$token" params={{ token: record.token }} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    View record
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
