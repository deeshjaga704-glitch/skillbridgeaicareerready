import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  url: z.string().min(4).max(300),
  skill: z.string().min(1).max(80),
});

export type CheckOutcome = "pass" | "warn" | "fail";

export type AssessmentCheck = {
  id: string;
  label: string;
  outcome: CheckOutcome;
  detail: string;
  /** 0..1 — how strong this signal is */
  strength: number;
};

export type AssessmentDimension = { dimension: string; score: number; note: string };

export type ProjectAssessment = {
  repo: string;
  repoUrl: string;
  checks: AssessmentCheck[];
  dimensions: AssessmentDimension[];
  tests: { framework?: string; files: number; ciRun?: { conclusion: string; at: string; name: string } };
  overall: number;
  verdict: "verified" | "partial" | "not_verified";
  summary: string;
};

const TEST_HINT = /(^|\/)(tests?|__tests__|spec)\//i;
const TEST_FILE = /(\.test\.|\.spec\.|^test_|_test\.)/i;

function ghHeaders() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SkillBridge-AI",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]! };
}

function frameworkFor(paths: string[]): string | undefined {
  if (paths.some((p) => /pytest\.ini|conftest\.py|tox\.ini/i.test(p))) return "pytest";
  if (paths.some((p) => /vitest\.config\./i.test(p))) return "Vitest";
  if (paths.some((p) => /jest\.config\./i.test(p))) return "Jest";
  if (paths.some((p) => /go\.mod/i.test(p)) && paths.some((p) => /_test\.go$/.test(p))) return "go test";
  if (paths.some((p) => /pom\.xml|build\.gradle/i.test(p))) return "JUnit";
  return undefined;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Runs real, verifiable checks against a public GitHub project:
 * commit history, test files, CI test runs, documentation and language match.
 */
export const assessProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ProjectAssessment> => {
    const parsed = parseRepo(data.url);
    if (!parsed) throw new Error("That doesn't look like a public GitHub repository URL.");
    const { owner, repo } = parsed;

    const repoInfo = await gh<{
      full_name: string;
      html_url: string;
      default_branch: string;
      pushed_at: string;
      created_at: string;
      fork: boolean;
      size: number;
      license: { spdx_id: string } | null;
    }>(`/repos/${owner}/${repo}`);
    if (!repoInfo) throw new Error("We couldn't reach that repository. Is it public and spelled correctly?");

    const [commits, tree, languages, runs, readme] = await Promise.all([
      gh<{ commit: { author: { date: string } | null }; author: { login: string } | null }[]>(
        `/repos/${owner}/${repo}/commits?per_page=100`,
      ),
      gh<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
        `/repos/${owner}/${repo}/git/trees/${repoInfo.default_branch}?recursive=1`,
      ),
      gh<Record<string, number>>(`/repos/${owner}/${repo}/languages`),
      gh<{ workflow_runs: { name: string; conclusion: string | null; updated_at: string; event: string }[] }>(
        `/repos/${owner}/${repo}/actions/runs?per_page=20`,
      ),
      gh<{ size: number }>(`/repos/${owner}/${repo}/readme`),
    ]);

    const checks: AssessmentCheck[] = [];

    /* 1. Commit history ------------------------------------------------ */
    const dates = (commits ?? [])
      .map((c) => c.commit.author?.date)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => a - b);
    const spanDays = dates.length > 1 ? (dates[dates.length - 1]! - dates[0]!) / 864e5 : 0;
    const byDay = new Set(dates.map((t) => new Date(t).toISOString().slice(0, 10)));
    const commitOk = dates.length >= 8 && spanDays >= 5;
    checks.push({
      id: "commits",
      label: "Commit history",
      outcome: commitOk ? "pass" : dates.length >= 3 ? "warn" : "fail",
      detail: dates.length
        ? `${dates.length} commits across ${byDay.size} days (${Math.round(spanDays)} day span)`
        : "No commit history found",
      strength: clamp(Math.min(100, dates.length * 4 + Math.min(spanDays, 60))) / 100,
    });

    /* 2. Test files ----------------------------------------------------- */
    const paths = (tree?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
    const testFiles = paths.filter((p) => TEST_HINT.test(p) || TEST_FILE.test(p));
    const framework = frameworkFor(paths);
    checks.push({
      id: "tests",
      label: "Automated tests",
      outcome: testFiles.length >= 3 ? "pass" : testFiles.length > 0 ? "warn" : "fail",
      detail: testFiles.length
        ? `${testFiles.length} test file(s) found${framework ? ` · ${framework}` : ""}`
        : "No test files found in the repository",
      strength: Math.min(1, testFiles.length / 6),
    });

    /* 3. CI test runs (real executed results) ---------------------------- */
    const lastRun = (runs?.workflow_runs ?? []).find((r) => r.conclusion);
    checks.push({
      id: "ci",
      label: "CI test run",
      outcome: lastRun ? (lastRun.conclusion === "success" ? "pass" : "fail") : "warn",
      detail: lastRun
        ? `“${lastRun.name}” finished ${lastRun.conclusion} on ${new Date(lastRun.updated_at).toLocaleDateString()}`
        : "No CI pipeline has run on this project",
      strength: lastRun ? (lastRun.conclusion === "success" ? 1 : 0.15) : 0.35,
    });

    /* 4. Documentation --------------------------------------------------- */
    const readmeSize = readme?.size ?? 0;
    checks.push({
      id: "docs",
      label: "Documentation",
      outcome: readmeSize > 1500 ? "pass" : readmeSize > 200 ? "warn" : "fail",
      detail: readmeSize ? `README is ${(readmeSize / 1024).toFixed(1)} KB` : "No README found",
      strength: Math.min(1, readmeSize / 3000),
    });

    /* 5. Skill / language match ------------------------------------------ */
    const langs = Object.keys(languages ?? {});
    const skillLower = data.skill.toLowerCase();
    const langMatch =
      langs.some((l) => l.toLowerCase() === skillLower) ||
      paths.some((p) => p.toLowerCase().includes(skillLower)) ||
      /docker/i.test(skillLower) === paths.some((p) => /dockerfile/i.test(p));
    checks.push({
      id: "match",
      label: `Evidence uses ${data.skill}`,
      outcome: langMatch ? "pass" : "warn",
      detail: langs.length ? `Languages detected: ${langs.slice(0, 4).join(", ")}` : "No language data available",
      strength: langMatch ? 0.9 : 0.3,
    });

    /* 6. Originality signal ----------------------------------------------- */
    const singleDump = dates.length > 0 && byDay.size <= 1;
    checks.push({
      id: "originality",
      label: "Originality signal",
      outcome: repoInfo.fork ? "warn" : singleDump ? "warn" : "pass",
      detail: repoInfo.fork
        ? "This repository is a fork — authorship is harder to attribute"
        : singleDump
        ? "All commits landed on a single day"
        : "Work was built up incrementally under your own account",
      strength: repoInfo.fork ? 0.35 : singleDump ? 0.45 : 0.85,
    });

    /* Dimensions ----------------------------------------------------------- */
    const testScore = clamp(
      (testFiles.length ? 55 + Math.min(25, testFiles.length * 5) : 15) +
        (lastRun?.conclusion === "success" ? 20 : lastRun ? -10 : 0),
    );
    const dimensions: AssessmentDimension[] = [
      {
        dimension: "Correctness",
        score: clamp(lastRun?.conclusion === "success" ? 90 : lastRun ? 45 : testFiles.length ? 70 : 55),
        note: lastRun ? `Last CI run: ${lastRun.conclusion}` : "No CI evidence — judged on test files only",
      },
      { dimension: "Testing", score: testScore, note: `${testFiles.length} test file(s) in the repo` },
      {
        dimension: "Documentation",
        score: clamp(readmeSize / 30),
        note: readmeSize ? `${(readmeSize / 1024).toFixed(1)} KB README` : "No README",
      },
      {
        dimension: "Originality",
        score: clamp(repoInfo.fork ? 45 : singleDump ? 55 : 60 + Math.min(35, byDay.size * 3)),
        note: `${byDay.size} distinct commit day(s)`,
      },
    ];

    const overall = clamp(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
    const failed = checks.filter((c) => c.outcome === "fail").length;
    const verdict: ProjectAssessment["verdict"] =
      failed === 0 && overall >= 70 ? "verified" : failed <= 1 && overall >= 50 ? "partial" : "not_verified";

    return {
      repo: repoInfo.full_name,
      repoUrl: repoInfo.html_url,
      checks,
      dimensions,
      tests: {
        ...(framework ? { framework } : {}),
        files: testFiles.length,
        ...(lastRun
          ? { ciRun: { conclusion: lastRun.conclusion ?? "unknown", at: lastRun.updated_at, name: lastRun.name } }
          : {}),
      },
      overall,
      verdict,
      summary:
        verdict === "verified"
          ? "Every check passed and the evidence is strong enough to verify this skill."
          : verdict === "partial"
          ? "Most checks passed, but some signals were weak — this counts as partial evidence."
          : "The checks didn't find enough working evidence to verify this skill yet.",
    };
  });
