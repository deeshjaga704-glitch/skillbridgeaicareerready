import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSkills, getStudent, type Skill } from "@/lib/skillbridge-store";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock interview — SkillBridge AI" },
      {
        name: "description",
        content: "Practise answering questions about your own verified projects and get plain-language feedback.",
      },
      { property: "og:title", content: "Mock interview — SkillBridge AI" },
      { property: "og:description", content: "A low-pressure interview rehearsal built around your real evidence." },
    ],
  }),
  component: InterviewPage,
});

type Msg = { id: string; from: "coach" | "you"; text: string; feedback?: string[] };

function questionsFor(skills: Skill[], role?: string): string[] {
  const verified = skills.filter((s) => s.status === "verified");
  const claimed = skills.filter((s) => s.status === "claimed");
  const qs = [
    `Let's warm up. Why ${role || "this role"}, and what pulled you toward it?`,
    ...verified.slice(0, 3).map((s) => `Walk me through something you built with ${s.name}. What was the hardest part?`),
    ...claimed.slice(0, 2).map((s) => `You list ${s.name} but it isn't verified yet. How would you describe your level honestly?`),
    "Tell me about a time your first approach didn't work. What did you change?",
    "What's something you'd like to get much better at in your first year on the job?",
  ];
  return qs;
}

function feedbackFor(answer: string): string[] {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const out: string[] = [];
  out.push(
    words < 25
      ? "Add a bit more detail — interviewers want the situation, what you did, and how it turned out."
      : "Good length — you gave enough context to follow the story.",
  );
  out.push(
    /\b(i|my)\b/i.test(answer)
      ? "Nice use of \"I\" — it's clear what you personally did."
      : "Try saying \"I\" more often so your own contribution stands out.",
  );
  out.push(
    /\d/.test(answer)
      ? "The concrete numbers make this believable."
      : "One number (users, rows, minutes saved) would make this land harder.",
  );
  return out;
}

function InterviewPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qs = questionsFor(getSkills(), getStudent()?.targetRole);
    setQuestions(qs);
    setMessages([
      {
        id: "intro",
        from: "coach",
        text: "Hi! This is practice, not a test — nobody sees your answers. Take your time.",
      },
      { id: "q0", from: "coach", text: qs[0] },
    ]);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const next: Msg[] = [
      ...messages,
      { id: crypto.randomUUID(), from: "you", text },
      { id: crypto.randomUUID(), from: "coach", text: "Here's what I noticed:", feedback: feedbackFor(text) },
    ];
    const ni = qIndex + 1;
    if (ni < questions.length) {
      next.push({ id: crypto.randomUUID(), from: "coach", text: questions[ni] });
      setQIndex(ni);
    } else {
      next.push({
        id: crypto.randomUUID(),
        from: "coach",
        text: "That's the full set — you handled it well. Run it again any time before a real interview.",
      });
    }
    setMessages(next);
    setDraft("");
  };

  const restart = () => {
    setQIndex(0);
    setMessages([{ id: "q0", from: "coach", text: questions[0] }]);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Mock interview</h1>
          <p className="text-muted-foreground">
            Questions are built from your own verified work, so the practice matches what you'll actually be asked.
          </p>
        </header>

        <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
          {messages.map((m) => (
            <div key={m.id} className={m.from === "you" ? "flex justify-end" : "flex gap-3"}>
              {m.from === "coach" && (
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={
                  m.from === "you"
                    ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                    : "max-w-[80%] rounded-2xl bg-muted px-4 py-2"
                }
              >
                <p className="text-sm">{m.text}</p>
                {m.feedback && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {m.feedback.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                )}
              </div>
              {m.from === "you" && (
                <span className="ml-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your answer the way you'd say it out loud…"
            rows={4}
            className="rounded-2xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={send} className="rounded-full">
              <Send className="mr-1 h-4 w-4" /> Send answer
            </Button>
            <Button variant="secondary" onClick={restart} className="rounded-full">
              <RefreshCw className="mr-1 h-4 w-4" /> Start over
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/jobs">Go to job matches</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
