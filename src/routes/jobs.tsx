import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./skills";
export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "Job matches — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Job Matches" />,
});
