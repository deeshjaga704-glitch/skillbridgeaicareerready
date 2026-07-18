// Shared mock data + localStorage-backed store for SkillBridge AI prototype.
// This is a client-only prototype; no backend yet.

export type SkillStatus = "verified" | "claimed";

export type Skill = {
  id: string;
  name: string;
  status: SkillStatus;
  source: "resume" | "manual" | "project";
  lastVerifiedAt?: string; // ISO
  confidenceLow?: number;
  confidenceHigh?: number;
};

export type Student = {
  name: string;
  email?: string;
  yearOfStudy: string;
  targetRole: string;
  resumeFileName?: string;
  createdAt: string;
};

export type ReadinessScore = {
  low: number;
  high: number;
  verifiedProjects: number;
};

const STORAGE_KEY = "skillbridge:student:v1";
const SKILLS_KEY = "skillbridge:skills:v1";

export function getStudent(): Student | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Student) : null;
  } catch {
    return null;
  }
}

export function saveStudent(student: Student) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(student));
}

export function clearStudent() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SKILLS_KEY);
}

const now = new Date();
const monthsAgo = (m: number) =>
  new Date(now.getFullYear(), now.getMonth() - m, now.getDate()).toISOString();

export const DEFAULT_SKILLS: Skill[] = [
  { id: "s1", name: "Python", status: "verified", source: "project", lastVerifiedAt: monthsAgo(1), confidenceLow: 72, confidenceHigh: 84 },
  { id: "s2", name: "Git & GitHub", status: "verified", source: "project", lastVerifiedAt: monthsAgo(2), confidenceLow: 80, confidenceHigh: 92 },
  { id: "s3", name: "SQL", status: "verified", source: "project", lastVerifiedAt: monthsAgo(7), confidenceLow: 55, confidenceHigh: 68 },
  { id: "s4", name: "Docker", status: "verified", source: "project", lastVerifiedAt: monthsAgo(3), confidenceLow: 60, confidenceHigh: 74 },
  { id: "s5", name: "React", status: "claimed", source: "resume" },
  { id: "s6", name: "System Design", status: "claimed", source: "resume" },
  { id: "s7", name: "AWS", status: "claimed", source: "manual" },
  { id: "s8", name: "TypeScript", status: "claimed", source: "resume" },
];

export function getSkills(): Skill[] {
  if (typeof window === "undefined") return DEFAULT_SKILLS;
  try {
    const raw = localStorage.getItem(SKILLS_KEY);
    if (!raw) return DEFAULT_SKILLS;
    return JSON.parse(raw) as Skill[];
  } catch {
    return DEFAULT_SKILLS;
  }
}

export function saveSkills(skills: Skill[]) {
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
}

export function computeReadiness(skills: Skill[]): ReadinessScore {
  const verified = skills.filter((s) => s.status === "verified");
  const base = Math.min(85, 40 + verified.length * 7);
  return {
    low: Math.max(0, base - 6),
    high: Math.min(100, base + 5),
    verifiedProjects: verified.length,
  };
}

export function isDecaying(skill: Skill): boolean {
  if (!skill.lastVerifiedAt) return false;
  const months = (Date.now() - new Date(skill.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months >= 6;
}
