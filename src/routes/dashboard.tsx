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
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  computeReadiness,
  getActivity,
  getSkills,
  getStudent,
  isDecaying,
  type ActivityItem,
  type Skill,
  type Student,
} from "@/lib/skillbridge-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — SkillBridge AI" },
      { name: "description", content: "Your verified readiness score, skills, and next steps." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [ready, setReady] = useState(false);

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

  const score = useMemo(() => computeReadiness(skills), [skills]);
  const lastCalc = activity[0]?.at ?? new Date().toISOString();
  const verified = skills.filter((s) => s.status === "verified");
  const claimed = skills.filter((s) => s.status === "claimed");

  if (!ready) return null;

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
                <TrendingUp className="h-3 w-3" /> +8 this month
              </span>
            </div>

            <div className="mt-4 font-display text-7xl font-extrabold tracking-tight sm:text-8xl">
              {score.low}
              <span className="text-muted-foreground/60">–</span>
              {score.high}
              <span className="text-4xl text-muted-foreground">%</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Based on <span className="font-semibold text-foreground">{score.verifiedProjects} verified projects</span>. We show a
              range because a single number would be false precision.
            </p>

            {/* range bar */}
            <div className="mt-6">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 rounded-full gradient-brand"
                  style={{ left: `${score.low}%`, right: `${100 - score.high}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>Job-ready threshold · 75%</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              to: "/roadmap",
              icon: Target,
              title: "Your roadmap",
              desc: "Week-by-week plan",
              tint: "primary",
            },
            {
              to: "/projects",
              icon: Rocket,
              title: "Proof projects",
              desc: "Verify a new skill",
              tint: "teal",
            },
            {
              to: "/interview",
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
        />
        <SkillColumn
          title="Claimed, not yet verified"
          subtitle={`${claimed.length} skills waiting on proof`}
          skills={claimed}
        />
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
}: {
  title: string;
  subtitle: string;
  skills: Skill[];
  verified?: boolean;
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
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5"
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
              {verified && s.confidenceLow != null && (
                <span className="text-xs text-muted-foreground">
                  {s.confidenceLow}–{s.confidenceHigh}% confidence
                </span>
              )}
              {decaying && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                  <AlertCircle className="h-3 w-3 text-warning" /> may need practice
                </span>
              )}
              {!verified && (
                <Link
                  to="/projects"
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                >
                  Verify →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
