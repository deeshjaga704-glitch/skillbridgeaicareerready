import { supabase } from "./supabase";
import { getAuthenticatedSession } from "./auth";
import type { Skill, Student, VerificationRecord } from "../skillbridge-store";

export type OnboardingProfile = {
  name: string;
  educationLevel: string;
  currentJobRole: string;
  targetRole: string;
};

export async function saveOnboardingProfile(
  onboarding: OnboardingProfile,
) {
  const user = await getAuthenticatedSession();

  if (!user) {
    throw new Error("Please sign in before completing onboarding.");
  }


  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .upsert(
      {
        user_id: user.id,
        name: onboarding.name,
        education_level: onboarding.educationLevel,
        current_job_role: onboarding.currentJobRole,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (profileError) {
    throw profileError;
  }

  const goal = {
    student_id: profile.id,
    target_role: onboarding.targetRole,
    status: "active",
  };

  const { data: existingGoals, error: goalLookupError } = await supabase
    .from("career_goals")
    .select("id")
    .eq("student_id", profile.id)
    .limit(1);

  if (goalLookupError) {
    throw goalLookupError;
  }

  if (existingGoals.length > 0) {
    const { error: goalUpdateError } = await supabase
      .from("career_goals")
      .update(goal)
      .eq("id", existingGoals[0].id);

    if (goalUpdateError) {
      throw goalUpdateError;
    }
  } else {
    const { error: goalInsertError } = await supabase
      .from("career_goals")
      .insert(goal);

    if (goalInsertError) {
      throw goalInsertError;
    }
  }
}

export async function getAuthenticatedProfile(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedSession>>>;
  student: Student | null;
}> {
  const user = await getAuthenticatedSession();

  if (!user) {
    throw new Error("Please sign in to load your profile.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id, name, education_level, current_job_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  let targetRole: string | null = null;
  if (profile) {
    const { data: goal, error: goalError } = await supabase
      .from("career_goals")
      .select("target_role")
      .eq("student_id", profile.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (goalError) {
      throw goalError;
    }

    targetRole = goal?.target_role ?? null;
  }

  return {
    user,
    student: profile
      ? {
          name: profile.name,
          email: user.email,
          yearOfStudy: profile.education_level,
          targetRole: targetRole ?? profile.current_job_role,
          createdAt: user.created_at,
        }
      : null,
  };
}

type SkillProgressRow = {
  skill_name: string;
  category: string | null;
  proficiency: number | null;
  target_proficiency: number | null;
  evidence_count: number | null;
  last_practiced_at: string | null;
};

type VerificationStatusRow = {
  skill_name: string;
  outcome: string;
  timestamp: string;
};

export function mapAuthenticatedSkillProgress(
  progressRows: SkillProgressRow[],
  profileId: string,
  verificationRows: VerificationStatusRow[] = [],
): Skill[] {
  const verifiedBySkill = new Map(
    verificationRows
      .filter((row) => row.outcome === "verified")
      .map((row) => [row.skill_name.toLowerCase(), row.timestamp]),
  );

  return progressRows.map((row) => {
    const lastVerifiedAt = verifiedBySkill.get(row.skill_name.toLowerCase());
    return {
      id: `${profileId}:${row.skill_name}`,
      name: row.skill_name,
      status: lastVerifiedAt ? ("verified" as const) : ("needs-evidence" as const),
      source: lastVerifiedAt ? ("project" as const) : ("manual" as const),
      category: row.category ?? undefined,
      proficiency: row.proficiency ?? undefined,
      targetProficiency: row.target_proficiency ?? undefined,
      evidenceCount: row.evidence_count ?? undefined,
      lastPracticedAt: row.last_practiced_at ?? undefined,
      lastVerifiedAt,
    };
  });
}

export async function getAuthenticatedSkillProgress(): Promise<Skill[]> {
  const user = await getAuthenticatedSession();

  if (!user) {
    throw new Error("Please sign in to load your skills.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return [];
  }

  const [{ data: progressRows, error: progressError }, { data: verificationRows, error: verificationError }] =
    await Promise.all([
      supabase
        .from("skill_progress")
        .select(
          "skill_name, category, proficiency, target_proficiency, evidence_count, last_practiced_at",
        )
        .eq("student_id", profile.id),
      supabase
        .from("verification_records")
        .select("skill_name, outcome, timestamp")
        .eq("student_id", profile.id)
        .order("timestamp", { ascending: false }),
    ]);

  if (progressError) {
    throw progressError;
  }
  if (verificationError) {
    throw verificationError;
  }

  return mapAuthenticatedSkillProgress(
    (progressRows ?? []) as SkillProgressRow[],
    profile.id,
    (verificationRows ?? []) as VerificationStatusRow[],
  );

}

export async function persistVerifiedSkillProgress(
  skillName: string,
  practicedAt: string,
): Promise<void> {
  const user = await getAuthenticatedSession();

  if (!user) {
    throw new Error("Please sign in to save your verified skill.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error("Your student profile could not be found.");
  }

  const { data: progress, error: progressLookupError } = await supabase
    .from("skill_progress")
    .select("evidence_count")
    .eq("student_id", profile.id)
    .eq("skill_name", skillName)
    .maybeSingle();

  if (progressLookupError) {
    throw progressLookupError;
  }

  if (!progress) {
    throw new Error(`The skill "${skillName}" is not present in your Supabase skill progress.`);
  }

  const { error: updateError } = await supabase
    .from("skill_progress")
    .update({
      evidence_count: (progress.evidence_count ?? 0) + 1,
      last_practiced_at: practicedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", profile.id)
    .eq("skill_name", skillName);

  if (updateError) {
    throw updateError;
  }
}

export function toVerificationRecordRow(
  record: VerificationRecord,
  studentId: string,
) {
  return {
    id: record.id,
    student_id: studentId,
    skill_name: record.skillName,
    token: record.token,
    method: record.method,
    outcome: record.outcome,
    evidence_summary: record.evidenceSummary,
    evidence_url: record.evidenceUrl ?? null,
    reason: record.reason,
    timestamp: record.timestamp,
    signals: record.signals,
    analysis: record.analysis ?? null,
  };
}

export async function persistVerificationRecord(
  record: VerificationRecord,
): Promise<void> {
  const user = await getAuthenticatedSession();

  if (!user) {
    throw new Error("Please sign in to save your verification record.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error("Your student profile could not be found.");
  }

  const { error: insertError } = await supabase
    .from("verification_records")
    .insert(toVerificationRecordRow(record, profile.id));

  if (insertError) {
    throw insertError;
  }
}

export function fromVerificationRecordRow(
  row: {
    id: string;
    student_id: string;
    skill_name: string;
    token: string;
    method: VerificationRecord["method"];
    outcome: VerificationRecord["outcome"];
    evidence_summary: string;
    evidence_url: string | null;
    reason: string;
    timestamp: string;
    signals: VerificationRecord["signals"];
    analysis: VerificationRecord["analysis"] | null;
  },
  studentName: string,
): VerificationRecord {
  return {
    id: row.id,
    token: row.token,
    skillId: `${row.student_id}:${row.skill_name}`,
    skillName: row.skill_name,
    evidenceUrl: row.evidence_url ?? undefined,
    studentName,
    method: row.method,
    evidenceSummary: row.evidence_summary,
    outcome: row.outcome,
    signals: row.signals,
    timestamp: row.timestamp,
    reason: row.reason,
    analysis: row.analysis ?? undefined,
  };
}

type VerificationRecordRow = {
  id: string;
  student_id: string;
  skill_name: string;
  token: string;
  method: VerificationRecord["method"];
  outcome: VerificationRecord["outcome"];
  evidence_summary: string;
  evidence_url: string | null;
  reason: string;
  timestamp: string;
  created_at?: string | null;
  signals: VerificationRecord["signals"];
  analysis: VerificationRecord["analysis"] | null;
};

export function latestVerificationRecordsBySkill<T extends { id: string; skill_name: string; timestamp: string; created_at?: string | null }>(rows: T[]): T[] {
  const newestBySkill = new Map<string, T>();

  for (const row of rows) {
    const skillKey = row.skill_name.toLowerCase();
    const current = newestBySkill.get(skillKey);

    if (!current) {
      newestBySkill.set(skillKey, row);
      continue;
    }

    const currentTs = Date.parse(current.timestamp || "0");
    const nextTs = Date.parse(row.timestamp || "0");

    if (nextTs > currentTs) {
      newestBySkill.set(skillKey, row);
      continue;
    }

    if (nextTs === currentTs) {
      const currentCreatedAt = current.created_at ? Date.parse(current.created_at) : 0;
      const nextCreatedAt = row.created_at ? Date.parse(row.created_at) : 0;

      if (nextCreatedAt > currentCreatedAt) {
        newestBySkill.set(skillKey, row);
        continue;
      }

      if (nextCreatedAt === currentCreatedAt && row.id.localeCompare(current.id) > 0) {
        newestBySkill.set(skillKey, row);
      }
    }
  }

  return Array.from(newestBySkill.values());
}

export function mapAuthenticatedVerificationRecords(
  rows: VerificationRecordRow[],
  studentName: string,
): VerificationRecord[] {
  return rows.map((row) => fromVerificationRecordRow(row, studentName));
}

export async function getAuthenticatedVerificationRecords(): Promise<VerificationRecord[]> {
  const user = await getAuthenticatedSession();

  if (!user) {
    return [];
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return [];
  }

  const { data: rows, error: recordError } = await supabase
    .from("verification_records")
    .select(
      "id, student_id, skill_name, token, method, outcome, evidence_summary, evidence_url, reason, timestamp, created_at, signals, analysis",
    )
    .eq("student_id", profile.id)
    .order("timestamp", { ascending: false })
    .order("created_at", { ascending: false });

  if (recordError) {
    throw recordError;
  }

  return mapAuthenticatedVerificationRecords(
    latestVerificationRecordsBySkill((rows ?? []) as VerificationRecordRow[]),
    profile.name,
  );
}

export async function getAuthenticatedVerificationRecordByToken(
  token: string,
): Promise<VerificationRecord | null> {
  const user = await getAuthenticatedSession();

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return null;
  }

  const { data: row, error: recordError } = await supabase
    .from("verification_records")
    .select(
      "id, student_id, skill_name, token, method, outcome, evidence_summary, evidence_url, reason, timestamp, signals, analysis",
    )
    .eq("student_id", profile.id)
    .eq("token", token)
    .maybeSingle();

  if (recordError) {
    throw recordError;
  }

  return row ? fromVerificationRecordRow(row, profile.name) : null;
}