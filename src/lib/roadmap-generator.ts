import { requirementsForRole } from "@/lib/skillbridge-roles";
import type { Skill } from "@/lib/skillbridge-store";

export type RoadmapStepDefinition = {
  id: string;
  title: string;
  detail: string;
  auto?: boolean;
};

function requirementState(skills: Skill[], skillName: string): "verified" | "evidence" | "missing" {
  const skill = skills.find((candidate) => candidate.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return "missing";
  if (skill.status === "verified") return "verified";
  if (skill.status === "needs-evidence" || skill.status === "in-review" || skill.proficiency !== undefined) return "evidence";
  return "missing";
}

export function buildSteps(skills: Skill[], role?: string): RoadmapStepDefinition[] {
  const requirements = requirementsForRole(role);
  const orderedRequirements = requirements
    .map((requirement, index) => ({ requirement, index, state: requirementState(skills, requirement.skill) }))
    .sort((left, right) => Number(left.state === "verified") - Number(right.state === "verified") || left.index - right.index);

  return [
    { id: "profile", title: "Set up your profile", detail: "Name, year of study and target role.", auto: true },
    { id: "connect", title: "Connect your accounts", detail: "GitHub, coding practice and certificates feed your score." },
    ...orderedRequirements.map(({ requirement, state }) => ({
      id: `${requirement.importance}-${requirement.skill}`,
      title: state === "verified" ? `Verified ${requirement.skill}` : `${state === "evidence" ? "Strengthen" : "Verify"} ${requirement.skill}`,
      detail: state === "verified"
        ? `${requirement.skill} is backed by verification evidence.`
        : state === "evidence"
          ? `Add stronger evidence for ${requirement.skill}. ${requirement.why}`
          : requirement.why,
      auto: state === "verified",
    })),
    { id: "resume", title: "Generate your verified resume", detail: "Built only from evidence you can back up." },
    { id: "interview", title: "Run three mock interviews", detail: "Practise explaining your own projects out loud." },
    { id: "apply", title: "Approve your first application", detail: "Nothing is sent until you tap approve." },
  ];
}
