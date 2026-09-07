import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Github,
  Upload,
  Terminal,
  Mic,
  GraduationCap,
  ShieldCheck,
  FlaskConical,
  ScanSearch,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getSkills,
  getStudent,
  saveSkills,
  upsertRecord,
  pushActivity,
  type Skill,
  type VerificationMethod,
  type VerificationRecord,
} from "@/lib/skillbridge-store";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { skillState, projectsForSkill } from "@/lib/skillbridge-evidence";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a skill — SkillBridge AI" },
      {
        name: "description",
        content: "A step-by-step verification flow: pick a skill, attach evidence, watch the analysis, get a report.",
      },
      { property: "og:title", content: "Verify a skill — SkillBridge AI" },
      { property: "og:description", content: "Watch every verification step happen — no black box." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ skill: typeof s.skill === "string" ? s.skill : undefined }),
  component: VerifyFlow,
});

const SOURCES: { id: VerificationMethod; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "github-repo", label: "GitHub repository", desc: "We read commits, structure, and README.", icon: Github },
  { id: "in-platform-project", label: "Upload a project", desc: "Graded in-platform against a rubric.", icon: Upload },
  { id: "live-coding", label: "Live-coding check", desc: "25-minute timed task, same weight as a repo.", icon: Terminal },
  { id: "oral-walkthrough", label: "Oral walkthrough", desc: "Explain your project out loud.", icon: Mic },
  { id: "instructor-signoff", label: "Instructor sign-off", desc: "Your lecturer confirms the work.", icon: GraduationCap },
];

const RUNNING_STEPS = [
  "Fetching the project",
  "Reading commit history",
  "Looking for a test suite",
  "Checking the last test run",
  "Scoring documentation & originality",
];

const STEPS = ["Skill", "Evidence source", "Attach", "Checks", "Assessment", "Result"] as const;

const OUTCOME_ICON = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
} as const;

const OUTCOME_CLASS = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
} as const;

/** Deterministic assessment from the project evidence already on file (no repo linked). */
function localAssessment(skillName: string, summary: string): ProjectAssessment {
  const projects = projectsForSkill(skillName);
  const tests = projects.reduce((a, p) => a + p.tests.count, 0);
  const passing = projects.reduce((a, p) => a + p.tests.passing, 0);
  const rate = tests ? passing / tests : 0;
  const docs = projects.some((p) => p.documentation === "thorough") ? 85 : projects.length ? 62 : 30;
  const checks: AssessmentCheck[] = [
    {
      id: "projects",
      label: "Project on file",
      outcome: projects.length ? "pass" : "fail",
      detail: projects.length
        ? `${projects.length} graded project(s): ${projects.map((p) => p.title).join(", ")}`
        : "No graded project is attached to this skill yet",
      strength: projects.length ? 0.8 : 0,
    },
    {
      id: "tests",
      label: "Test run",
      outcome: tests === 0 ? "fail" : rate === 1 ? "pass" : "warn",
      detail: tests ? `${passing} of ${tests} tests passing` : "No tests were run for this evidence",
      strength: rate,
    },
    {
      id: "docs",
      label: "Documentation",
      outcome: docs >= 80 ? "pass" : docs >= 60 ? "warn" : "fail",
      detail: projects.length
        ? `Documentation rated ${projects[0]!.documentation}`
        : "Nothing to score yet",
      strength: docs / 100,
    },
  ];
  const dimensions = projects.length
    ? projects[0]!.assessment.map((a) => ({ dimension: a.dimension, score: a.score, note: a.note }))
    : [{ dimension: "Evidence", score: 20, note: "Nothing submitted yet" }];
  const overall = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  const failed = checks.filter((c) => c.outcome === "fail").length;
  const verdict: ProjectAssessment["verdict"] =
    failed === 0 && overall >= 70 ? "verified" : failed <= 1 && overall >= 50 ? "partial" : "not_verified";
  return {
    repo: summary || "Submitted project",
    repoUrl: "",
    checks,
    dimensions,
    tests: { files: tests },
    overall,
    verdict,
    summary:
      verdict === "verified"
        ? "The checks ran clean on your submitted project."
        : verdict === "partial"
        ? "Some checks were weak — this counts as partial evidence."
        : "There isn't enough working evidence here to verify the skill yet.",
  };
}

function VerifyFlow() {

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Verify a skill</h1>
          <p className="text-muted-foreground">
            Six visible steps. You see exactly what we check and why the result came out the way it did.
          </p>
        </header>

        {/* Stepper */}
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={
                i === step
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : i < step
                  ? "rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success"
                  : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border border-border bg-card p-6">
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold">Which skill are you proving?</h2>
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSkillId(s.id);
                    setStep(1);
                  }}
                  className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left hover:border-primary/40"
                >
                  <span className="font-medium">{s.name}</span>
                  <SkillStatusBadge state={skillState(s)} />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {projectsForSkill(s.name).length} project(s) on file
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold">
                How do you want to prove {skill?.name}?
              </h2>
              <p className="text-sm text-muted-foreground">
                All five carry the same weight. Pick whatever reflects your real work.
              </p>
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSource(s.id);
                    setStep(2);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left hover:border-primary/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.desc}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Attach your evidence</h2>
              <Input
                placeholder="https://github.com/you/your-project"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                We only read what you link. Nothing is published without you sharing it.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-full" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="rounded-full" onClick={() => setStep(3)}>
                  Start analysis <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <ScanSearch className="h-5 w-5 text-primary" /> Analysing your evidence
              </h2>
              <ul className="space-y-2">
                {ANALYSIS_STEPS.map((a, i) => (
                  <li
                    key={a.label}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                  >
                    {i <= done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    ) : (
                      <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <span>
                      <span className="block text-sm font-medium">{a.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i <= done ? a.detail : "waiting…"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <FlaskConical className="h-5 w-5 text-primary" /> Assessment
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { d: "Correctness", v: 94 },
                  { d: "Readability", v: 88 },
                  { d: "Testing", v: 90 },
                  { d: "Originality", v: 92 },
                ].map((x) => (
                  <div key={x.d} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{x.d}</span>
                      <span className="tabular-nums">{x.v}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full gradient-brand" style={{ width: `${x.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <Button className="rounded-full" onClick={finish}>
                See verification result <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 5 && record && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-success" />
                <h2 className="font-display text-xl font-bold">{record.skillName} verified</h2>
                <SkillStatusBadge state="verified" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { k: "Projects analysed", v: String(Math.max(1, projectsForSkill(record.skillName).length)) },
                  { k: "Skill level", v: "Working" },
                  { k: "Confidence", v: "70–83%" },
                  { k: "Verified on", v: new Date(record.timestamp).toLocaleDateString() },
                ].map((x) => (
                  <div key={x.k} className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.k}</div>
                    <div className="font-semibold">{x.v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capabilities demonstrated
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {record.signals.map((s) => (
                    <li key={s.type} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {s.label} — {s.detail}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/report/$token" params={{ token: record.token }}>
                  <Button className="rounded-full">Open evidence report</Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="outline" className="rounded-full">Back to dashboard</Button>
                </Link>
                <Link to="/appeals">
                  <Button variant="ghost" className="rounded-full">Disagree with this result?</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
