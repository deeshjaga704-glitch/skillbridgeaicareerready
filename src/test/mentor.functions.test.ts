import { describe, expect, it } from "vitest";
import {
  boundMentorHistory,
  buildMentorContext,
  conversationOwnership,
  MentorInput,
  normalizeMentorResponse,
} from "@/lib/mentor.functions";
import type { Skill } from "@/lib/skillbridge-store";

const skills: Skill[] = [
  {
    id: "react",
    name: "React",
    status: "needs-evidence",
    source: "manual",
    category: "technical",
    proficiency: 60,
    targetProficiency: 100,
    evidenceCount: 1,
    lastPracticedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "python",
    name: "Python",
    status: "verified",
    source: "project",
    confidenceLow: 80,
    confidenceHigh: 90,
  },
];

describe("mentor context", () => {
  it("contains bounded profile, progress, readiness, gaps, and evidence summaries", () => {
    const context = buildMentorContext({
      profile: { name: "Alex", education: "Third year", currentRole: "Student" },
      careerGoal: "Software Engineer",
      skills,
      verificationSummaries: [
        {
          skillName: "Python",
          outcome: "verified",
          method: "github-repo",
          summary: "Tests and repository history were inspected.",
          reason: "Evidence supports working ability.",
        },
      ],
    });

    expect(context.profile.name).toBe("Alex");
    expect(context.careerGoal).toBe("Software Engineer");
    expect(context.skills).toHaveLength(2);
    expect(context.skills[0]).toMatchObject({ name: "React", proficiency: 60, state: "needs-evidence" });
    expect(context.skills[1]).toMatchObject({ name: "Python", state: "verified" });
    expect(context.verificationSummaries[0]?.skillName).toBe("Python");
    expect(context.readiness.roleMatch).toBeTypeOf("number");
  });
});

describe("mentor response normalization", () => {
  it("normalizes bounded structured fields and supplies a safe fallback message", () => {
    const response = normalizeMentorResponse({
      message: "  Focus on React practice. ",
      suggestedActions: Array.from({ length: 8 }, (_, index) => `Action ${index}`),
      referencedSkills: ["React", 4, "Python"],
      referencedEvidence: ["Repository tests"],
    });

    expect(response).toEqual({
      message: "Focus on React practice.",
      suggestedActions: ["Action 0", "Action 1", "Action 2", "Action 3"],
      referencedSkills: ["React", "Python"],
      referencedEvidence: ["Repository tests"],
    });
    expect(normalizeMentorResponse({}).message).toContain("grounded response");
  });
});

describe("persisted mentor history", () => {
  it("keeps only the latest eight messages and preserves user/assistant roles", () => {
    const history = boundMentorHistory(
      Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
        content: `Message ${index}`,
        createdAt: `2026-09-01T00:00:0${index}.000Z`,
      })),
    );

    expect(history).toHaveLength(8);
    expect(history[0]).toEqual({ role: "user", content: "Message 2" });
    expect(history[7]).toEqual({ role: "assistant", content: "Message 9" });
  });

  it("derives ownership only from the authenticated student ID", () => {
    expect(conversationOwnership("authenticated-student")).toEqual({
      student_id: "authenticated-student",
    });
    expect(MentorInput.safeParse({
      userMessage: "hello",
      studentId: "another-student",
    }).data).toEqual({ userMessage: "hello" });
  });
});
