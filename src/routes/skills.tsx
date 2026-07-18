import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/skills")({
  head: () => ({ meta: [{ title: "Skill gap — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Skill Gap" />,
});

export function ComingSoon({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-card p-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          Coming next. We're shipping the core flow first — Landing, Onboarding, and Dashboard.
        </p>
      </div>
    </AppShell>
  );
}
