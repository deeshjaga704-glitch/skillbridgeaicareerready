import { describe, expect, it } from "vitest";
import { skillMatchScore, skillState } from "@/lib/skillbridge-evidence";
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