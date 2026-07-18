import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./skills";
export const Route = createFileRoute("/roadmap")({
  head: () => ({ meta: [{ title: "Roadmap — SkillBridge AI" }] }),
  component: () => <ComingSoon title="Roadmap" />,
});
