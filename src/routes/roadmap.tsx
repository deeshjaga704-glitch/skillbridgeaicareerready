import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ArrowRight, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getSkills, getStudent, type Skill, type Student } from "@/lib/skillbridge-store";
import { requirementsForRole } from "@/lib/skillbridge-roles";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Your roadmap — SkillBridge AI" },
      {
        name: "description",
        content: "A sequenced, checklist-style plan that takes you from where you are to job-ready.",
      },
      { property: "og:title", content: "Your roadmap — SkillBridge AI" },
      { property: "og:description", content: "One step at a time — a plain-language plan to reach your target role." },
    ],
  }),
  component: RoadmapPage,
});

const DONE_KEY = "skillbridge:roadmap-done:v1";

type Step = { id: string; title: string; detail: string; auto?: boolean };

type StepAction = {
  label: string;
  to: "/onboarding" | "/connections" | "/projects" | "/resume" | "/interview" | "/jobs";
};

function actionForStep(step: Step): StepAction {
  if (step.id.startsWith("core-") || step.id.startsWith("helpful-")) {
    return { label: "Verify with a proof project", to: "/projects" };
  }
  switch (step.id) {
    case "profile":
      return { label: "Set up your profile", to: "/onboarding" };
    case "connect":
      return { label: "Connect your accounts", to: "/connections" };
    case "resume":
      return { label: "Generate your resume", to: "/resume" };
    case "interview":
      return { label: "Run a mock interview", to: "/interview" };
    case "apply":
      return { label: "Browse matched jobs", to: "/jobs" };
    default:
      return { label: "Start a proof project", to: "/projects" };
  }
}

function buildSteps(skills: Skill[], role?: string): Step[] {
  const verified = new Set(
    skills.filter((s) => s.status === "verified").map((s) => s.name.toLowerCase()),
  );
  const reqs = requirementsForRole(role);
  const core = reqs.filter((r) => r.importance === "core");
  const helpful = reqs.filter((r) => r.importance === "helpful");

  return [
    { id: "profile", title: "Set up your profile", detail: "Name, year of study and target role.", auto: true },
    { id: "connect", title: "Connect your accounts", detail: "GitHub, coding practice and certificates feed your score." },
    ...core.map((r) => ({
      id: `core-${r.skill}`,
      title: `Verify ${r.skill}`,
      detail: r.why,
      auto: verified.has(r.skill.toLowerCase()),
    })),
    ...helpful.map((r) => ({
      id: `helpful-${r.skill}`,
      title: `Strengthen ${r.skill}`,
      detail: r.why,
      auto: verified.has(r.skill.toLowerCase()),
    })),
    { id: "resume", title: "Generate your verified resume", detail: "Built only from evidence you can back up." },
    { id: "interview", title: "Run three mock interviews", detail: "Practise explaining your own projects out loud." },
    { id: "apply", title: "Approve your first application", detail: "Nothing is sent until you tap approve." },
  ];
}

function RoadmapPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    setSkills(getSkills());
    setStudent(getStudent());
    try {
      const raw = localStorage.getItem(DONE_KEY);
      if (raw) setDone(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const steps = buildSteps(skills, student?.targetRole);
  const isDone = (s: Step) => s.auto || done.includes(s.id);
  const completed = steps.filter(isDone).length;
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    localStorage.setItem(DONE_KEY, JSON.stringify(next));
  };

  const nextIndex = steps.findIndex((s) => !isDone(s));
  const nextStep = nextIndex >= 0 ? steps[nextIndex] : undefined;

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight">Your roadmap</h1>
            {student?.targetRole && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                <Target className="h-3.5 w-3.5" />
                Goal: {student.targetRole}
              </span>
            )}
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Work down the list in order. Each step is small on purpose — steady beats heroic.
          </p>
        </header>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall progress</p>
              <p className="font-display text-2xl font-bold">
                {completed}
                <span className="text-muted-foreground">/{steps.length} steps done</span>
              </p>
            </div>
            {nextStep ? (
              <p className="text-sm text-muted-foreground">
                Up next: <span className="font-medium text-foreground">{nextStep.title}</span>
              </p>
            ) : (
              <p className="text-sm font-medium text-primary">All steps complete — great work.</p>
            )}
          </div>
          <Progress value={pct} aria-label="Overall roadmap progress" className="mt-4 h-2" />
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => {
            const complete = isDone(step);
            const isCurrent = i === nextIndex;
            const isUpcoming = !complete && !isCurrent;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-3xl border p-5",
                  isCurrent
                    ? "border-primary/40 bg-primary-soft/60 shadow-sm"
                    : "border-border bg-card",
                  complete && "border-border bg-card/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-pressed={complete}
                  aria-label={complete ? `Mark ${step.title} as not done` : `Mark ${step.title} as done`}
                  className="mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {complete ? (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={cn("font-medium", complete && "text-muted-foreground line-through")}>
                      {i + 1}. {step.title}
                    </p>
                    {isCurrent && (
                      <Badge variant="default" className="rounded-full">
                        Next up
                      </Badge>
                    )}
                    {complete && (
                      <span className="text-xs font-semibold text-primary">Completed</span>
                    )}
                    {isUpcoming && <span className="text-xs text-muted-foreground">Upcoming</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                  {isCurrent && (
                    <div className="mt-3">
                      <Button asChild size="sm" className="rounded-full">
                        <Link to={actionForStep(step).to}>
                          {actionForStep(step).label} <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full">
            <Link to="/projects">
              Start a proof project <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/skills">See your skill gap</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
