import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerificationRecord } from "@/lib/skillbridge-store";
import * as skillbridgeStore from "@/lib/skillbridge-store";

const supabaseFrom = vi.fn();

vi.mock("@/lib/supabase/supabase", () => ({
  supabase: {
    from: supabaseFrom,
  },
}));

describe("public verification report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders a valid real verification record from the live data source", async () => {
    const realRecord = {
      id: "real-1",
      student_id: "student-1",
      skill_name: "React",
      token: "real-token",
      method: "github-repo",
      outcome: "verified",
      evidence_summary: "Real evidence record",
      evidence_url: null,
      reason: "Verified in the live system.",
      timestamp: new Date().toISOString(),
      signals: [{
        type: "project",
        label: "Project check",
        outcome: "pass",
        strength: 0.9,
        detail: "Real verification signal",
      }],
      analysis: null,
    };

    supabaseFrom.mockImplementation((table: string) => {
      if (table === "verification_records") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: realRecord, error: null }),
            }),
          }),
        };
      }

      if (table === "student_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { name: "Ada" }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const getRecordByTokenSpy = vi.spyOn(skillbridgeStore, "getRecordByToken");
    const { loadReportRecord } = await import("@/routes/report.$token");
    const result = await loadReportRecord("real-token");

    expect(result.record?.token).toBe("real-token");
    expect(result.record?.studentName).toBe("Ada");
    expect(result.report).not.toBeNull();
    expect(getRecordByTokenSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the real verification record is missing", async () => {
    const demoRecord: VerificationRecord = {
      id: "demo-1",
      token: "missing-token",
      skillId: "skill-demo",
      skillName: "Demo Skill",
      studentName: "Demo User",
      method: "in-platform-project",
      outcome: "verified",
      evidenceSummary: "Stale demo data",
      timestamp: new Date().toISOString(),
      reason: "Prototype fallback data",
      signals: [],
    };

    supabaseFrom.mockImplementation((table: string) => {
      if (table === "verification_records") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    localStorage.setItem("verification-records", JSON.stringify([demoRecord]));
    const getRecordByTokenSpy = vi.spyOn(skillbridgeStore, "getRecordByToken");
    const { loadReportRecord } = await import("@/routes/report.$token");
    const result = await loadReportRecord("missing-token");

    expect(result.record).toBeNull();
    expect(result.report).toBeNull();
    expect(getRecordByTokenSpy).not.toHaveBeenCalled();
  });

  it("does not allow unrelated demo storage records to appear as a report", async () => {
    const demoRecord: VerificationRecord = {
      id: "demo-2",
      token: "different-token",
      skillId: "skill-demo",
      skillName: "Demo Skill",
      studentName: "Demo User",
      method: "in-platform-project",
      outcome: "verified",
      evidenceSummary: "Unrelated localStorage entry",
      timestamp: new Date().toISOString(),
      reason: "Prototype local storage data",
      signals: [],
    };

    supabaseFrom.mockImplementation((table: string) => {
      if (table === "verification_records") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    localStorage.setItem("verification-records", JSON.stringify([demoRecord]));
    const getRecordByTokenSpy = vi.spyOn(skillbridgeStore, "getRecordByToken");
    const { loadReportRecord } = await import("@/routes/report.$token");
    const result = await loadReportRecord("real-but-missing-token");

    expect(result.record).toBeNull();
    expect(result.report).toBeNull();
    expect(getRecordByTokenSpy).not.toHaveBeenCalled();
  });
});
