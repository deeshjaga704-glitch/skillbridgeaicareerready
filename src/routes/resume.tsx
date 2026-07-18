import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./skills";
export const Route = createFileRoute("/resume")({
  head: () => ({ meta: [{ title: "Resume — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Resume" />,
});
