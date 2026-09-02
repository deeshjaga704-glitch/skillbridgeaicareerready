import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unzipSync, strFromU8 } from "fflate";

const Input = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  /** base64 (no data: prefix), max ~8MB */
  data: z.string().min(10).max(12_000_000),
});

export type ExtractedSkill = {
  name: string;
  category: "technical" | "concept" | "tool" | "project";
  evidenceHint: string;
};

export type RoleSuggestion = { role: string; match: number; why: string };

export type ResumeExtraction = {
  skills: ExtractedSkill[];
  roles: RoleSuggestion[];
  projects: { title: string; technologies: string[] }[];
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This DOCX file looks empty or corrupted.");
  const xml = strFromU8(doc);
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM = `You read a student's resume and list what they CLAIM to know.
Never judge or verify ability — extraction is a claim, not proof.
Extract concrete, well-known skill names (deduplicated, canonical casing, e.g. "Git & GitHub", "PostgreSQL", "React").
Categories: technical (languages/frameworks), concept (CS/theory topics like Data Structures, OOP, Machine Learning),
tool (Git, Docker, AWS, VS Code, Figma), project (capabilities demonstrated inside project descriptions,
e.g. Database Design, CRUD Operations, REST API Design, Backend Development).
Also suggest up to 4 plausible career paths with a rough 0-100 match number and one plain-language reason.
Ignore soft skills, hobbies and personal details. Return 8-30 skills.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["skills", "roles", "projects"],
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "evidenceHint"],
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["technical", "concept", "tool", "project"] },
          evidenceHint: { type: "string" },
        },
      },
    },
    roles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "match", "why"],
        properties: {
          role: { type: "string" },
          match: { type: "number" },
          why: { type: "string" },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "technologies"],
        properties: {
          title: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const extractResumeSkills = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ResumeExtraction> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const mime = data.mimeType.toLowerCase();
    const isPdf = mime.includes("pdf") || data.fileName.toLowerCase().endsWith(".pdf");
    const isDocx =
      mime.includes("wordprocessingml") || data.fileName.toLowerCase().endsWith(".docx");

    let userContent: unknown;
    if (isPdf) {
      userContent = [
        { type: "text", text: "Extract the claimed skills and career paths from this resume." },
        {
          type: "file",
          file: { filename: data.fileName, file_data: `data:application/pdf;base64,${data.data}` },
        },
      ];
    } else {
      const bytes = base64ToBytes(data.data);
      const text = isDocx ? docxToText(bytes) : strFromU8(bytes).trim();
      if (text.length < 30) throw new Error("We couldn't read any text from that file.");
      userContent = [
        {
          type: "text",
          text: `Extract the claimed skills and career paths from this resume text:\n\n${text.slice(0, 40000)}`,
        },
      ];
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "resume_extraction", strict: true, schema: SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many requests right now — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
      throw new Error(`Resume analysis failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as ResumeExtraction;

    const seen = new Set<string>();
    return {
      skills: (parsed.skills ?? [])
        .filter((s) => s?.name && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()) !== undefined)
        .slice(0, 40),
      roles: (parsed.roles ?? [])
        .map((r) => ({ ...r, match: Math.max(0, Math.min(100, Math.round(r.match))) }))
        .slice(0, 4),
      projects: (parsed.projects ?? []).slice(0, 8),
    };
  });
