import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSteps, getConnectionCompletionState } from "@/lib/roadmap-generator";
import { requirementsForRole } from "@/lib/skillbridge-roles";
import { buildRoadmapStepRows, getRoadmapStatus, progressFromSteps, shouldRepairRoadmap, withRoadmapInitializationLock } from "@/lib/supabase/roadmap";
import { getConnections, saveConnections, setActiveUserId } from "@/lib/skillbridge-store";
import type { Skill } from "@/lib/skillbridge-store";

const skills: Skill[] = [
  { id: "python", name: "Python", status: "verified", source: "manual" },
  { id: "typescript", name: "TypeScript", status: "claimed", source: "manual" },
  { id: "docker", name: "Docker", status: "verified", source: "project" },
  { id: "git", name: "Git & GitHub", status: "claimed", source: "manual" },
];

describe("roadmap generator", () => {
  it("builds role-specific frontend, data science, and DevOps requirements", () => {
    expect(requirementsForRole(" Frontend Engineer ").map((requirement) => requirement.skill)).toEqual([
      "HTML/CSS",
      "JavaScript",
      "React",
      "TypeScript",
      "Git & GitHub",
      "Testing",
      "API integration",
      "Deployment",
    ]);
    expect(requirementsForRole("Data Scientist").map((requirement) => requirement.skill)).toContain("Statistics");
    expect(requirementsForRole("Data Scientist").map((requirement) => requirement.skill)).not.toContain("Kubernetes");
    expect(requirementsForRole("DevOps Engineer").map((requirement) => requirement.skill)).toEqual([
      "Linux", "Shell/Bash", "Git & GitHub", "Networking", "CI/CD", "Docker",
      "Kubernetes", "Infrastructure as Code", "Cloud", "Monitoring", "Security", "Incident Response",
    ]);
  });

  it("does not reuse the default roadmap for known roles and falls back for unknown roles", () => {
    const defaultSkills = requirementsForRole("Unknown role").map((requirement) => requirement.skill);
    expect(requirementsForRole("Frontend Engineer").map((requirement) => requirement.skill)).not.toEqual(defaultSkills);
    expect(requirementsForRole("Data Scientist").map((requirement) => requirement.skill)).not.toEqual(defaultSkills);
    expect(requirementsForRole("Unknown role")).toEqual(requirementsForRole(""));
  });

  it("puts the selected role's first requirement in the next skill milestone", () => {
    const frontendSteps = buildSteps([], "Frontend Engineer");
    const dataSteps = buildSteps([], "Data Scientist");
    const devopsSteps = buildSteps([], "DevOps Engineer");

    expect(frontendSteps.find((step) => !step.auto)?.title).toBe("Connect your accounts");
    expect(dataSteps.find((step) => step.id === "core-Python")?.title).toBe("Verify Python");
    expect(devopsSteps.find((step) => step.id.startsWith("core-"))?.title).toBe("Verify Linux");
  });

  it("uses the selected role instead of a frontend-biased default", () => {
    const devopsSteps = buildSteps([], "DevOps Engineer");
    const backendSteps = buildSteps([], "Backend Engineer");

    expect(devopsSteps.map((step) => step.title).join(" ")).toContain("Linux");
    expect(devopsSteps.map((step) => step.title).join(" ")).toContain("Kubernetes");
    expect(devopsSteps.map((step) => step.title).join(" ")).not.toContain("React");
    expect(backendSteps.map((step) => step.title).join(" ")).toContain("APIs");
    expect(backendSteps.map((step) => step.title).join(" ")).toContain("SQL");
    expect(backendSteps.map((step) => step.title).join(" ")).not.toContain("React");
  });

  it("handles verified, evidenced, and missing skills without fake verification", () => {
    const steps = buildSteps(skills, "DevOps Engineer");

    expect(steps.find((step) => step.title === "Verified Docker")?.auto).toBe(true);
    expect(steps.find((step) => step.title === "Verify Git & GitHub")?.auto).toBe(false);
    expect(steps.find((step) => step.title === "Verify Linux")?.auto).toBe(false);
    expect(steps.some((step) => step.title.includes("React"))).toBe(false);
  });

  it("treats the connect milestone as a signal milestone and allows any supported account to complete it", () => {
    const emptyState = getConnectionCompletionState([]);
    const oneConnected = getConnectionCompletionState([{ id: "github", connected: true }]);
    const twoConnected = getConnectionCompletionState([
      { id: "github", connected: true },
      { id: "leetcode", connected: true },
    ]);
    const allConnected = getConnectionCompletionState([
      { id: "github", connected: true },
      { id: "leetcode", connected: true },
      { id: "hackerrank", connected: true },
      { id: "linkedin", connected: true },
    ]);

    expect(emptyState).toMatchObject({ connectedCount: 0, hasAny: false, isComplete: false });
    expect(oneConnected).toMatchObject({ connectedCount: 1, hasAny: true, isComplete: true });
    expect(twoConnected).toMatchObject({ connectedCount: 2, hasAny: true, isComplete: true });
    expect(allConnected).toMatchObject({ connectedCount: 4, hasAny: true, isComplete: true });

    const noConnections = buildSteps([], "Software Engineer", []);
    const signalOnly = buildSteps([], "Software Engineer", [{ id: "github", connected: true }]);

    expect(noConnections.find((step) => step.id === "connect")?.auto).toBe(false);
    expect(signalOnly.find((step) => step.id === "connect")?.auto).toBe(true);
    expect(signalOnly.find((step) => step.title === "Verify Git & GitHub")?.auto).toBe(false);
  });

  it("keeps connection signals separate from verified skills and does not auto-complete real skill milestones", () => {
    const steps = buildSteps([
      { id: "python", name: "Python", status: "claimed", source: "manual" },
      { id: "sql", name: "SQL", status: "claimed", source: "manual" },
    ], "Data Scientist", [{ id: "github", connected: true }]);

    expect(steps.find((step) => step.title === "Connect your accounts")?.auto).toBe(true);
    expect(steps.find((step) => step.id === "core-Python")?.auto).toBe(false);
    expect(steps.find((step) => step.id === "core-SQL")?.auto).toBe(false);
    expect(steps.find((step) => step.id === "core-Python")?.title).toBe("Verify Python");
    expect(steps.find((step) => step.id === "core-SQL")?.title).toBe("Verify SQL");
  });

  describe("connection storage isolation", () => {
    beforeEach(() => {
      localStorage.clear();
      setActiveUserId(null);
    });

    afterEach(() => {
      localStorage.clear();
      setActiveUserId(null);
    });

    it("keeps user A and user B connection state isolated", () => {
      setActiveUserId("user-a");
      saveConnections([
        { id: "github", label: "GitHub", connected: true, quality: "official-api" },
      ]);

      setActiveUserId("user-b");
      expect(getConnections()).toEqual([]);

      setActiveUserId("user-a");
      expect(getConnections()).toMatchObject([{ id: "github", connected: true }]);
    });

    it("uses empty connections for an authenticated user with no scoped data", () => {
      setActiveUserId("user-a");
      expect(getConnections()).toEqual([]);
    });

    it("ignores stale global prototype connection data when a user is authenticated", () => {
      localStorage.setItem("skillbridge:connections:v2", JSON.stringify([
        { id: "linkedin", label: "LinkedIn", connected: true, quality: "manual" },
      ]));

      setActiveUserId("user-a");
      expect(getConnections()).toEqual([]);
    });

    it("keeps connection state stable after switching accounts", () => {
      setActiveUserId("user-a");
      saveConnections([
        { id: "github", label: "GitHub", connected: true, quality: "official-api" },
        { id: "leetcode", label: "LeetCode", connected: false, quality: "best-effort" },
      ]);

      setActiveUserId("user-b");
      saveConnections([
        { id: "linkedin", label: "LinkedIn", connected: true, quality: "manual" },
      ]);

      setActiveUserId("user-a");
      expect(getConnections()).toMatchObject([
        { id: "github", connected: true },
        { id: "leetcode", connected: false },
      ]);
    });
  });

  it("supports frontend, SRE, and role switching", () => {
    const frontendSteps = buildSteps([], "Frontend Engineer");
    const sreSteps = buildSteps([], "Site Reliability Engineer");

    expect(frontendSteps.some((step) => step.title === "Verify React")).toBe(true);
    expect(frontendSteps.some((step) => step.title === "Verify TypeScript")).toBe(true);
    expect(sreSteps.some((step) => step.title === "Verify Observability")).toBe(true);
    expect(sreSteps.some((step) => step.title === "Verify SLIs/SLOs/SLAs")).toBe(true);
    expect(sreSteps.some((step) => step.title.includes("React"))).toBe(false);
  });

  it("keeps empty steps distinct from a completed roadmap", () => {
    const emptyRoadmap = getRoadmapStatus([]);
    expect(emptyRoadmap).toMatchObject({ hasMilestones: false, isEmpty: true, isComplete: false, nextStep: undefined });

    const completeRoadmap = getRoadmapStatus([
      { completed: true, id: "a" },
      { completed: true, id: "b" },
    ]);
    expect(completeRoadmap).toMatchObject({ hasMilestones: true, isEmpty: false, isComplete: true, nextStep: undefined });

    const incompleteRoadmap = getRoadmapStatus([
      { completed: true, id: "a" },
      { completed: false, id: "b" },
    ]);
    expect(incompleteRoadmap).toMatchObject({ hasMilestones: true, isEmpty: false, isComplete: false, nextStep: { id: "b" } });
  });

  it("resolves software engineer explicitly instead of falling through to default requirements", () => {
    const roleRequirements = requirementsForRole("Software Engineer");
    expect(roleRequirements.map((requirement) => requirement.skill)).toEqual([
      "Programming fundamentals",
      "Git & GitHub",
      "SQL",
      "Testing",
      "System Design",
    ]);
    expect(roleRequirements).toEqual(requirementsForRole("software engineer"));
  });

  it("creates roadmap steps for a missing roadmap and avoids duplicate replacements", () => {
    const definitions = buildSteps([], "Software Engineer");
    const rows = buildRoadmapStepRows(definitions, new Set());

    expect(rows).toHaveLength(definitions.length);
    expect(rows[0]).toMatchObject({ title: "Set up your profile" });

    const existingRoadmap = {
      id: "roadmap-1",
      student_id: "student-1",
      career_goal_id: "goal-1",
      title: "Your Career Roadmap",
      description: null,
      status: "active",
      progress_percentage: 0,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    };
    const matchingDefinitions = buildSteps([], "Software Engineer");
    const matchingRows = buildRoadmapStepRows(matchingDefinitions, new Set());

    expect(shouldRepairRoadmap({
      roadmap: existingRoadmap,
      goalId: "goal-1",
      existingSteps: matchingRows,
      definitions: matchingDefinitions,
    })).toBe(false);

    expect(shouldRepairRoadmap({
      roadmap: existingRoadmap,
      goalId: "goal-1",
      existingSteps: [],
      definitions: matchingDefinitions,
    })).toBe(true);
  });

  it("serializes initialization for one student and calculates persisted progress", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      events.push("first-queued");
      releaseFirst = resolve;
    });

    const first = withRoadmapInitializationLock("student-1", async () => {
      events.push("first-started");
      await firstStarted;
      events.push("first-finished");
      return "first";
    });
    const second = withRoadmapInitializationLock("student-1", async () => {
      events.push("second-started");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first-queued", "first-started"]);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first-queued", "first-started", "first-finished", "second-started"]);
    expect(progressFromSteps([{ progress_percentage: 100 }, { progress_percentage: 0 }, { progress_percentage: 100 }])).toBe(67);
  });
});
