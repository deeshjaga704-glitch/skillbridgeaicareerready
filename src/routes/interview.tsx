import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./skills";
export const Route = createFileRoute("/interview")({
  head: () => ({ meta: [{ title: "Mock interview — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Mock Interview" />,
});
