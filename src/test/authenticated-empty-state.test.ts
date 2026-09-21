import { describe, expect, it } from "vitest";
import { buildMentorContext } from "@/lib/mentor/context";
import { roleReadiness, scoreFactors } from "@/lib/skillbridge-evidence";
import { mapAuthenticatedSkillProgress } from "@/lib/supabase/profile";

describe("authenticated empty student isolation", () => {
  it("does not invent skills, evidence, activity, or profile data", () => {
    const skills = mapAuthenticatedSkillProgress([], "new-student", []);
    const factors = scoreFactors(skills, "Frontend Developer");
    const readiness = roleReadiness(skills, "Frontend Developer");
    const mentor = buildMentorContext({
      profile: { name: "Test User", education: "First year", currentRole: "Student" },
      careerGoal: "Frontend Developer",
      skills,
      verificationSummaries: [],
    });

    expect(skills).toEqual([]);
    expect(factors.every((factor) => factor.value === 0)).toBe(true);
    expect(readiness.pct).toBe(0);
    expect(mentor.skills).toEqual([]);
    expect(mentor.verificationSummaries).toEqual([]);
    expect(mentor.readiness.low).toBe(0);
    expect(mentor.readiness.high).toBe(0);
    expect(mentor.careerGoal).toBe("Frontend Developer");
  });
});
