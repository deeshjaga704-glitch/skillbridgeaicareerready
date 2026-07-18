import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./skills";
export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Proof projects — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Proof Projects" />,
});
