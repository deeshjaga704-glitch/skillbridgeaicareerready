import { describe, expect, it } from "vitest";
import { buildSteps } from "@/lib/roadmap-generator";
import { requirementsForRole } from "@/lib/skillbridge-roles";
import { progressFromSteps, withRoadmapInitializationLock } from "@/lib/supabase/roadmap";
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

  it("supports frontend, SRE, and role switching", () => {
    const frontendSteps = buildSteps([], "Frontend Engineer");
    const sreSteps = buildSteps([], "Site Reliability Engineer");

    expect(frontendSteps.some((step) => step.title === "Verify React")).toBe(true);
    expect(frontendSteps.some((step) => step.title === "Verify TypeScript")).toBe(true);
    expect(sreSteps.some((step) => step.title === "Verify Observability")).toBe(true);
    expect(sreSteps.some((step) => step.title === "Verify SLIs/SLOs/SLAs")).toBe(true);
    expect(sreSteps.some((step) => step.title.includes("React"))).toBe(false);
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
