import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createServerSupabaseClient, getServerAuthenticatedUser } from "@/lib/supabase/server";
import { roleReadiness, scoreFactors, skillState } from "@/lib/skillbridge-evidence";
import type { Skill } from "@/lib/skillbridge-store";

const MessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const MentorInput = z.object({
  userMessage: z.string().trim().min(1).max(4000),
});

export type MentorMessage = z.infer<typeof MessageInput>;

export type MentorContext = {
  profile: {
    name: string;
    education: string | null;
    currentRole: string | null;
  };
  careerGoal: string | null;
  skills: Array<{
    name: string;
    category: string | null;
    proficiency: number | null;
    targetProficiency: number | null;
    evidenceCount: number;
    lastPracticedAt: string | null;
    state: ReturnType<typeof skillState>;
  }>;
  readiness: {
    low: number;
    high: number;
    roleMatch: number;
    gaps: string[];
  };
  verificationSummaries: Array<{
    skillName: string;
    outcome: string;
    method: string;
    summary: string;
    reason: string;
  }>;
};

export type MentorResponse = {
  message: string;
  suggestedActions: string[];
  referencedSkills: string[];
  referencedEvidence: string[];
};

export type PersistedMentorMessage = MentorMessage & {
  createdAt: string;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    suggestedActions: { type: "ARRAY", items: { type: "STRING" } },
    referencedSkills: { type: "ARRAY", items: { type: "STRING" } },
    referencedEvidence: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["message", "suggestedActions", "referencedSkills", "referencedEvidence"],
};

const SYSTEM_PROMPT = `You are SkillBridge AI, an evidence-aware career mentor.
Use only the student's supplied profile, goal, skill progress, readiness, verification summaries, and conversation.
Distinguish progress or claims from verified evidence. Never call a skill verified unless a verification summary says outcome verified.
Do not invent history, achievements, projects, certifications, or evidence. Say when information is unavailable.
Identify concrete skill gaps and suggest practical next actions or learning tasks. Keep responses concise and supportive.
Return JSON matching the requested schema.`;

function clampList(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .slice(0, limit);
}

export function normalizeMentorResponse(value: unknown): MentorResponse {
  const response = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    message:
      typeof response.message === "string" && response.message.trim()
        ? response.message.trim()
        : "I could not form a grounded response from the available information.",
    suggestedActions: clampList(response.suggestedActions, 4),
    referencedSkills: clampList(response.referencedSkills, 8),
    referencedEvidence: clampList(response.referencedEvidence, 6),
  };
}

export function boundMentorHistory(messages: PersistedMentorMessage[]): MentorMessage[] {
  return messages.slice(-8).map(({ role, content }) => ({ role, content }));
}

export function conversationOwnership(studentId: string) {
  return { student_id: studentId };
}

export function buildMentorContext(input: {
  profile: { name: string; education: string | null; currentRole: string | null };
  careerGoal: string | null;
  skills: Skill[];
  verificationSummaries: MentorContext["verificationSummaries"];
}): MentorContext {
  const role = input.careerGoal ?? input.profile.currentRole ?? undefined;
  const factors = scoreFactors(input.skills, role);
  const readiness = roleReadiness(input.skills, role);

  return {
    profile: input.profile,
    careerGoal: input.careerGoal,
    skills: input.skills.slice(0, 40).map((skill) => ({
      name: skill.name,
      category: skill.category ?? null,
      proficiency: skill.proficiency ?? null,
      targetProficiency: skill.targetProficiency ?? null,
      evidenceCount: skill.evidenceCount ?? 0,
      lastPracticedAt: skill.lastPracticedAt ?? null,
      state: skillState(skill),
    })),
    readiness: {
      low: input.skills.length ? Math.max(0, Math.min(100, factors.reduce((total, factor) => total + factor.value, 0) - 6)) : 0,
      high: input.skills.length ? Math.min(100, factors.reduce((total, factor) => total + factor.value, 0) + 5) : 0,
      roleMatch: readiness.pct,
      gaps: readiness.missing.slice(0, 8).map((gap) => gap.skill),
    },
    verificationSummaries: input.verificationSummaries.slice(0, 20),
  };
}

async function loadMentorContext(userId: string): Promise<{ studentId: string; context: MentorContext }> {
  const supabase = createServerSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id, name, education_level, current_job_role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Your student profile could not be found.");

  const [{ data: goal, error: goalError }, { data: progress, error: progressError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabase.from("career_goals").select("target_role").eq("student_id", profile.id).eq("status", "active").maybeSingle(),
      supabase
        .from("skill_progress")
        .select("skill_name, category, proficiency, target_proficiency, evidence_count, last_practiced_at")
        .eq("student_id", profile.id),
      supabase
        .from("verification_records")
        .select("skill_name, outcome, method, evidence_summary, reason")
        .eq("student_id", profile.id)
        .order("timestamp", { ascending: false })
        .limit(20),
    ]);
  if (goalError) throw goalError;
  if (progressError) throw progressError;
  if (recordsError) throw recordsError;

  const skills: Skill[] = (progress ?? []).map((row) => ({
    id: `${profile.id}:${row.skill_name}`,
    name: row.skill_name,
    status: "needs-evidence",
    source: "manual",
    category: row.category ?? undefined,
    proficiency: row.proficiency ?? undefined,
    targetProficiency: row.target_proficiency ?? undefined,
    evidenceCount: row.evidence_count ?? undefined,
    lastPracticedAt: row.last_practiced_at ?? undefined,
  }));

  return {
    studentId: profile.id,
    context: buildMentorContext({
      profile: {
      name: profile.name,
      education: profile.education_level,
      currentRole: profile.current_job_role,
      },
      careerGoal: goal?.target_role ?? null,
      skills,
      verificationSummaries: (records ?? []).map((record) => ({
        skillName: record.skill_name,
        outcome: record.outcome,
        method: record.method,
        summary: record.evidence_summary,
        reason: record.reason,
      })),
    }),
  };
}

async function getOrCreateConversation(supabase: ReturnType<typeof createServerSupabaseClient>, studentId: string): Promise<string> {
  const ownership = conversationOwnership(studentId);
  const { data: existing, error: lookupError } = await supabase
    .from("mentor_conversations")
    .select("id")
    .match(ownership)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("mentor_conversations")
    .insert({ ...ownership, status: "active" })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

async function loadPersistedHistory(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  conversationId: string,
): Promise<MentorMessage[]> {
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  const messages = (data ?? []).reverse().map((message) => ({
    role: message.role as MentorMessage["role"],
    content: message.content,
    createdAt: message.created_at,
  }));
  return boundMentorHistory(messages);
}

async function persistMessage(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  conversationId: string,
  message: MentorMessage,
) {
  const { error } = await supabase.from("mentor_messages").insert({
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
  });
  if (error) throw error;
}

async function callGemini(recentMessages: MentorMessage[], context: MentorContext): Promise<MentorResponse> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured. Add GEMINI_API_KEY to your local .env file.");

  const model = process.env["GEMINI_MODEL"] ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify({ context, recentMessages }) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Mentor request failed (${response.status}).`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Mentor returned an empty response.");
  return normalizeMentorResponse(JSON.parse(text));
}

export const askMentor = createServerFn({ method: "POST" })
  .validator((input: unknown) => MentorInput.parse(input))
  .handler(async ({ data }) => {
    const user = await getServerAuthenticatedUser();
    if (!user) throw new Error("Please sign in before using the AI mentor.");
    const supabase = createServerSupabaseClient();
    try {
      const { studentId, context } = await loadMentorContext(user.id);
      const conversationId = await getOrCreateConversation(supabase, studentId);
      await persistMessage(supabase, conversationId, { role: "user", content: data.userMessage });
      const history = await loadPersistedHistory(supabase, conversationId);
      const response = await callGemini(history, context);
      await persistMessage(supabase, conversationId, { role: "assistant", content: response.message });
      return response;
    } catch (error) {
      console.error("Mentor request failed", error);
      throw new Error("The mentor could not process your request. Please try again.");
    }
  });
