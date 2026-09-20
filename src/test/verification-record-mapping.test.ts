import { describe, expect, it } from "vitest";
import {
  fromVerificationRecordRow,
  latestVerificationRecordsBySkill,
  toVerificationRecordRow,
} from "@/lib/supabase/profile";
import type { VerificationRecord } from "@/lib/skillbridge-store";

describe("toVerificationRecordRow", () => {
  it("maps the existing verification record without changing its identity or outcome", () => {
    const record: VerificationRecord = {
      id: "record-1",
      token: "react-token",
      skillId: "skill-1",
      skillName: "React",
      evidenceUrl: "https://github.com/example/react-project",
      studentName: "Arjun",
      method: "github-repo",
      evidenceSummary: "example/react-project - 12 commits, 8 files",
      outcome: "partial",
      signals: [],
      timestamp: "2026-09-10T12:00:00.000Z",
      reason: "Some evidence was found.",
      analysis: {
        source: "github",
        overall: 64,
        dimensions: [],
        facts: {},
        warnings: [],
      },
    };

    expect(toVerificationRecordRow(record, "student-1")).toEqual({
      id: "record-1",
      student_id: "student-1",
      skill_name: "React",
      token: "react-token",
      method: "github-repo",
      outcome: "partial",
      evidence_summary: "example/react-project - 12 commits, 8 files",
      evidence_url: "https://github.com/example/react-project",
      reason: "Some evidence was found.",
      timestamp: "2026-09-10T12:00:00.000Z",
      signals: [],
      analysis: record.analysis,
    });
  });
});

describe("fromVerificationRecordRow", () => {
  it("maps an owned Supabase row into the existing record shape", () => {
    const record = fromVerificationRecordRow({
      id: "record-1",
      student_id: "student-1",
      skill_name: "React",
      token: "react-token",
      method: "github-repo",
      outcome: "verified",
      evidence_summary: "Repository evidence",
      evidence_url: null,
      reason: "Evidence passed",
      timestamp: "2026-09-10T12:00:00.000Z",
      signals: [],
      analysis: null,
    }, "Arjun");

    expect(record).toEqual({
      id: "record-1",
      token: "react-token",
      skillId: "student-1:React",
      skillName: "React",
      studentName: "Arjun",
      method: "github-repo",
      evidenceSummary: "Repository evidence",
      outcome: "verified",
      signals: [],
      timestamp: "2026-09-10T12:00:00.000Z",
      reason: "Evidence passed",
    });
  });
});

describe("latestVerificationRecordsBySkill", () => {
  it("keeps only the newest record for each skill while preserving different skills", () => {
    const records = [
      {
        id: "old-react",
        student_id: "student-1",
        skill_name: "React",
        token: "react-old-token",
        method: "github-repo",
        outcome: "verified",
        evidence_summary: "old summary",
        evidence_url: null,
        reason: "older signal",
        timestamp: "2026-09-15T00:00:00.000Z",
        created_at: "2026-09-15T00:00:00.000Z",
        signals: [],
        analysis: null,
      },
      {
        id: "new-react",
        student_id: "student-1",
        skill_name: "React",
        token: "react-new-token",
        method: "github-repo",
        outcome: "verified",
        evidence_summary: "new summary",
        evidence_url: null,
        reason: "newer signal",
        timestamp: "2026-09-19T00:00:00.000Z",
        created_at: "2026-09-19T00:00:00.000Z",
        signals: [],
        analysis: null,
      },
      {
        id: "sql-1",
        student_id: "student-1",
        skill_name: "SQL",
        token: "sql-token",
        method: "in-platform-project",
        outcome: "partial",
        evidence_summary: "sql summary",
        evidence_url: null,
        reason: "sql signal",
        timestamp: "2026-09-10T00:00:00.000Z",
        created_at: "2026-09-10T00:00:00.000Z",
        signals: [],
        analysis: null,
      },
    ];

    const latest = latestVerificationRecordsBySkill(records as any);

    expect(latest.map((row) => row.id).sort()).toEqual(["new-react", "sql-1"].sort());
    expect(latest.some((row) => row.skill_name === "React" && row.id === "new-react")).toBe(true);
  });

  it("keeps the newest record when timestamps are equal by using created_at as a tiebreaker", () => {
    const records = [
      {
        id: "older-id",
        student_id: "student-1",
        skill_name: "React",
        token: "react-old-token",
        method: "github-repo",
        outcome: "verified",
        evidence_summary: "older summary",
        evidence_url: null,
        reason: "older signal",
        timestamp: "2026-09-15T00:00:00.000Z",
        created_at: "2026-09-15T00:00:00.000Z",
        signals: [],
        analysis: null,
      },
      {
        id: "newer-id",
        student_id: "student-1",
        skill_name: "React",
        token: "react-new-token",
        method: "github-repo",
        outcome: "verified",
        evidence_summary: "newer summary",
        evidence_url: null,
        reason: "newer signal",
        timestamp: "2026-09-15T00:00:00.000Z",
        created_at: "2026-09-15T00:00:05.000Z",
        signals: [],
        analysis: null,
      },
    ];

    const latest = latestVerificationRecordsBySkill(records as any);

    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe("newer-id");
  });

  it("returns an empty array when no records exist without altering the historical dataset", () => {
    expect(latestVerificationRecordsBySkill([])).toEqual([]);
  });
});