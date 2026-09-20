import { describe, expect, it } from "vitest";
import {
  PROJECT_EVIDENCE,
  scoreFactors,
  skillMatchScore,
  skillState,
} from "@/lib/skillbridge-evidence";
import { mapAuthenticatedSkillProgress } from "@/lib/supabase/profile";
import type { Skill } from "@/lib/skillbridge-store";

const progressSkill: Skill = {
  id: "react",
  name: "React",
  status: "needs-evidence",
  source: "manual",
  proficiency: 70,
  targetProficiency: 100,
  evidenceCount: 0,
};

describe("skillState", () => {
  it("keeps an explicitly needs-evidence skill unverified", () => {
    expect(skillState(progressSkill)).toBe("needs-evidence");
  });

  it("decays old verified evidence into needs-evidence", () => {
    const oldVerification: Skill = {
      ...progressSkill,
      status: "verified",
      lastVerifiedAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    expect(skillState(oldVerification)).toBe("needs-evidence");
  });

  it("maps a verified Supabase record to verified without trusting proficiency", () => {
    const [verified, unverified] = mapAuthenticatedSkillProgress([
      { skill_name: "React", category: "technical", proficiency: 70, target_proficiency: 100, evidence_count: 1, last_practiced_at: null },
      { skill_name: "TypeScript", category: "technical", proficiency: 60, target_proficiency: 100, evidence_count: 0, last_practiced_at: null },
    ], "student-1", [
      { skill_name: "React", outcome: "verified", timestamp: "2026-09-15T00:00:00.000Z" },
    ]);

    expect(verified).toMatchObject({ name: "React", status: "verified", source: "project", evidenceCount: 1 });
    expect(unverified).toMatchObject({ name: "TypeScript", status: "needs-evidence", source: "manual", evidenceCount: 0 });
  });
});

describe("skillMatchScore", () => {
  it("uses relevant proficiency as a partial role match", () => {
    expect(skillMatchScore(progressSkill, "React")).toBe(0.7);
  });

  it("does not turn unverified proficiency into verified status", () => {
    expect(skillMatchScore(progressSkill, "React")).toBeGreaterThan(0);
    expect(skillState(progressSkill)).not.toBe("verified");
  });
});

describe("scoreFactors", () => {
  it("derives readiness from authenticated skill evidence and ignores legacy project fixtures", () => {
    const skills = mapAuthenticatedSkillProgress([
      { skill_name: "React", category: "technical", proficiency: 85, target_proficiency: 100, evidence_count: 2, last_practiced_at: null },
      { skill_name: "TypeScript", category: "technical", proficiency: 65, target_proficiency: 100, evidence_count: 1, last_practiced_at: null },
      { skill_name: "Node.js", category: "technical", proficiency: 45, target_proficiency: 100, evidence_count: 0, last_practiced_at: null },
    ], "student-1", [
      { skill_name: "React", outcome: "verified", timestamp: "2026-09-15T00:00:00.000Z" },
      { skill_name: "TypeScript", outcome: "verified", timestamp: "2026-09-16T00:00:00.000Z" },
    ]);

    const baseline = scoreFactors(skills, "Frontend Engineer");
    const technical = baseline.find((factor) => factor.label === "Technical skills");
    const evidence = baseline.find((factor) => factor.label === "Evidence");
    const labels = baseline.map((factor) => factor.label);

    expect(technical?.value).toBeGreaterThan(0);
    expect(technical?.why).toContain("2 authenticated skills verified");
    expect(evidence?.why).toContain("3 authenticated evidence signals");
    expect(labels).not.toContain("Project evidence");
    expect(labels).not.toContain("Testing & quality");

    const legacyFixtureCount = PROJECT_EVIDENCE.length;
    PROJECT_EVIDENCE.length = 0;
    const shadowed = scoreFactors(skills, "Frontend Engineer");
    PROJECT_EVIDENCE.push(...Array.from({ length: legacyFixtureCount }, (_, index) => ({
      id: `fixture-${index}`,
      title: `Legacy fixture ${index}`,
      summary: "Legacy fixture",
      skills: ["React"],
      technologies: ["React"],
      githubUrl: "https://example.com",
      tests: { count: 1, passing: 1 },
      documentation: "basic" as const,
      difficulty: "Starter" as const,
      readinessImpact: 0,
      assessment: [],
      completedAt: "2026-09-01T00:00:00.000Z",
    })));

    expect(shadowed).toEqual(baseline);
  });
});