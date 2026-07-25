import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Target,
  Rocket,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  Link2,
  Activity,
  ChevronDown,
  Copy,
  Scale,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  computeReadiness,
  getActivity,
  getSkills,
  getStudent,
  getSmoothedScore,
  saveSmoothedScore,
  isDecaying,
  type ActivityItem,
  type Skill,
  type Student,
} from "@/lib/skillbridge-store";
import { VerificationBadge } from "@/components/verification-badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — SkillBridge AI" },
      { name: "description", content: "Your verified readiness score, skills, and next steps." },
    ],
  }),
  component: Dashboard,
});

function useSmoothedRange(target: { low: number; high: number }) {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    const prev = getSmoothedScore() ?? target;
    setDisplay(prev);
    // smooth toward target: moving-average style, cap step at 3 points
    let cur = { ...prev };
    const tick = () => {
      const dl = target.low - cur.low;
      const dh = target.high - cur.high;
      if (Math.abs(dl) < 0.5 && Math.abs(dh) < 0.5) {
        cur = { ...target };
        setDisplay(cur);
        saveSmoothedScore(cur);
        return;
      }
      cur = {
        low: cur.low + Math.sign(dl) * Math.min(Math.abs(dl) * 0.35, 3),
        high: cur.high + Math.sign(dh) * Math.min(Math.abs(dh) * 0.35, 3),
      };
      setDisplay({ low: cur.low, high: cur.high });
      raf = requestAnimationFrame(() => setTimeout(tick, 80));
    };
    let raf = requestAnimationFrame(() => setTimeout(tick, 120));
    return () => cancelAnimationFrame(raf);
  }, [target.low, target.high]);
  return { low: Math.round(display.low), high: Math.round(display.high) };
}

function Dashboard() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [ready, setReady] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);

  useEffect(() => {
    const s = getStudent();
    setStudent(
      s ?? {
        name: "Alex Rivera",
        yearOfStudy: "Third year",
        targetRole: "Software Engineer",
        createdAt: new Date().toISOString(),
      },
    );
    setSkills(getSkills());
    setActivity(getActivity());
    setReady(true);
  }, []);

  const target = useMemo(() => computeReadiness(skills), [skills]);
  const smoothed = useSmoothedRange({ low: target.low, high: target.high });
  const lastCalc = activity[0]?.at ?? new Date().toISOString();
  const verified = skills.filter((s) => s.status === "verified");
  const claimed = skills.filter((s) => s.status === "claimed");
  const decaying = verified.filter((s) => isDecaying(s));

  if (!ready) return null;

  const copyShare = async (recordId?: string) => {
    if (!recordId) return;
    const skill = skills.find((s) => s.verificationRecordId === recordId);
    // token = record id in our store; look up via records
    const { getRecords } = await import("@/lib/skillbridge-store");
    const rec = getRecords().find((r) => r.id === recordId);
    if (!rec) return toast.error("Record unavailable");
    const url = `${window.location.origin}/v/${rec.token}`;
    await navigator.clipboard.writeText(url);
    toast.success(`Copied shareable link for ${skill?.name ?? rec.skillName}`);
  };

  return (
    <AppShell>
      {/* Greeting */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {student?.yearOfStudy} · Targeting{" "}
            <span className="font-medium text-foreground">{student?.targetRole}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {student?.name.split(" ")[0]}.
          </h1>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => navigate({ to: "/onboarding" })}
        >
          Edit target role
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Score card */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary-soft via-card to-teal-soft p-8 shadow-lg shadow-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Readiness score
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                <TrendingUp className="h-3 w-3" /> Smoothed over time
              </span>
            </div>

            <div className="mt-4 font-display text-7xl font-extrabold tracking-tight sm:text-8xl tabular-nums transition-all duration-500">
              {smoothed.low}
              <span className="text-muted-foreground/60">–</span>
              {smoothed.high}
              <span className="text-4xl text-muted-foreground">%</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Based on <span className="font-semibold text-foreground">{target.verifiedProjects} verified projects</span>. A range,
              not a single number, because a single number would be false precision.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last recalculated {new Date(lastCalc).toLocaleString()}
              {activity[0]?.reason ? ` · after ${activity[0].reason}` : ""}
            </p>

            {/* range bar */}
            <div className="mt-6">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 rounded-full gradient-brand transition-all duration-500"
                  style={{ left: `${smoothed.low}%`, right: `${100 - smoothed.high}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>Job-ready threshold · 75%</span>
                <span>100</span>
              </div>
            </div>

            {/* Why this score? */}
            <button
              type="button"
              onClick={() => setOpenWhy((v) => !v)}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium hover:bg-background"
              aria-expanded={openWhy}
            >
              <Scale className="h-3.5 w-3.5 text-primary" />
              Why this score?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openWhy ? "rotate-180" : ""}`} />
            </button>
            {openWhy && (
              <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lifting your score
                  </div>
                  <ul className="mt-2 space-y-1">
                    {verified.slice(0, 5).map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="font-medium">{s.name}</span>
                        {s.verificationMethod && <VerificationBadge method={s.verificationMethod} />}
                        {s.confidenceLow != null && (
                          <span className="text-xs text-muted-foreground">
                            +{Math.round((s.confidenceHigh! + s.confidenceLow) / 20)} pts
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                {decaying.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Decaying (not verified in 6+ months)
                    </div>
                    <ul className="mt-2 space-y-1">
                      {decaying.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 text-muted-foreground">
                          <AlertCircle className="h-3.5 w-3.5 text-warning" />
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="text-xs">−2 pts · refresh with a new proof</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Range width
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Range narrowed after <span className="font-medium text-foreground">{activity[0]?.reason ?? "recent activity"}</span>
                    {activity[0]?.detail ? ` — ${activity[0].detail}.` : "."} More consistent signals means a tighter range.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to="/projects">
                    <Button size="sm" variant="outline" className="rounded-full">Add a proof project</Button>
                  </Link>
                  <Link to="/appeals">
                    <Button size="sm" variant="ghost" className="rounded-full">Appeal a result</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              to: "/connections" as const,
              icon: Link2,
              title: "Connections",
              desc: "Link GitHub & profiles",
              tint: "primary",
            },
            {
              to: "/roadmap" as const,
              icon: Target,
              title: "Your roadmap",
              desc: "Week-by-week plan",
              tint: "primary",
            },
            {
              to: "/projects" as const,
              icon: Rocket,
              title: "Proof projects",
              desc: "Verify a new skill",
              tint: "teal",
            },
            {
              to: "/interview" as const,
              icon: MessageSquareText,
              title: "Mock interview",
              desc: "Practice out loud",
              tint: "coral",
            },
          ].map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className={
                  q.tint === "primary"
                    ? "grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"
                    : q.tint === "teal"
                    ? "grid h-11 w-11 place-items-center rounded-xl bg-teal-soft text-teal"
                    : "grid h-11 w-11 place-items-center rounded-xl bg-coral-soft text-coral"
                }
              >
                <q.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{q.title}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SkillColumn
          title="Verified"
          subtitle={`${verified.length} skills employers can trust`}
          skills={verified}
          verified
          onCopy={copyShare}
        />
        <SkillColumn
          title="Claimed, not yet verified"
          subtitle={`${claimed.length} skills waiting on proof`}
          skills={claimed}
        />
      </div>

      {/* Activity feed */}
      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-soft text-teal">
            <Activity className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-bold">Why your score changed</h2>
        </div>
        <ul className="mt-4 space-y-2">
          {activity.slice(0, 6).map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm"
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-medium">{a.reason}</span>
              {a.detail && (
                <span className="text-muted-foreground">— {a.detail}</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(a.at).toLocaleString()}
              </span>
            </li>
          ))}
          {activity.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No recalculations yet. Connect an account to get started.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary-soft/40 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold">Ready for your next verified skill?</div>
            <p className="text-sm text-muted-foreground">
              We'll pick the skill that lifts your score the most.
            </p>
          </div>
        </div>
        <Link to="/skills">
          <Button className="rounded-full">
            See skill gaps <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}

function SkillColumn({
  title,
  subtitle,
  skills,
  verified = false,
  onCopy,
}: {
  title: string;
  subtitle: string;
  skills: Skill[];
  verified?: boolean;
  onCopy?: (recordId?: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {skills.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </li>
        )}
        {skills.map((s) => {
          const decaying = verified && isDecaying(s);
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5"
            >
              {verified ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-success/20 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground">
                  <Circle className="h-3 w-3" />
                </span>
              )}
              <span className="font-medium">{s.name}</span>
              {verified && s.verificationMethod && <VerificationBadge method={s.verificationMethod} />}
              {verified && s.confidenceLow != null && (
                <span className="text-xs text-muted-foreground">
                  {s.confidenceLow}–{s.confidenceHigh}% confidence
                </span>
              )}
              {decaying && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                  <AlertCircle className="h-3 w-3 text-warning" /> may need practice
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {verified && s.verificationRecordId && onCopy && (
                  <button
                    type="button"
                    onClick={() => onCopy(s.verificationRecordId)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft"
                    title="Copy shareable verification link"
                  >
                    <Copy className="h-3 w-3" /> Share
                  </button>
                )}
                {!verified && (
                  <Link
                    to="/projects"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Verify →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
