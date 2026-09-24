import { requirementsForRole } from "@/lib/skillbridge-roles";
import type { Skill } from "@/lib/skillbridge-store";

export type RoadmapStepDefinition = {
  id: string;
  title: string;
  detail: string;
  auto?: boolean;
};

export type ConnectionEvidence = {
  id: string;
  connected: boolean;
};

export function getConnectionCompletionState(connections: ConnectionEvidence[] = []) {
  const supportedProviders = ["github", "leetcode", "hackerrank", "linkedin"] as const;
  const statusById = new Map(
    connections
      .filter((connection) => connection && typeof connection.id === "string")
      .map((connection) => [String(connection.id).toLowerCase(), Boolean(connection.connected)]),
  );

  const connectedCount = supportedProviders.filter((id) => statusById.get(id) === true).length;
  const hasAny = connectedCount > 0;
  const isComplete = hasAny;

  return {
    supportedProviders,
    connectedCount,
    isComplete,
    hasAny,
  };
}

function requirementState(skills: Skill[], skillName: string): "verified" | "evidence" | "missing" {
  const skill = skills.find((candidate) => candidate.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return "missing";
  if (skill.status === "verified") return "verified";
  if (skill.status === "needs-evidence" || skill.status === "in-review" || skill.proficiency !== undefined) return "evidence";
  return "missing";
}

export function buildSteps(skills: Skill[], role?: string, connections: ConnectionEvidence[] = []): RoadmapStepDefinition[] {
  const requirements = requirementsForRole(role);
  const orderedRequirements = requirements
    .map((requirement, index) => ({ requirement, index, state: requirementState(skills, requirement.skill) }))
    .sort((left, right) => Number(left.state === "verified") - Number(right.state === "verified") || left.index - right.index);
  const connectionState = getConnectionCompletionState(connections);

  return [
    { id: "profile", title: "Set up your profile", detail: "Name, year of study and target role.", auto: true },
    {
      id: "connect",
      title: "Connect your accounts",
      detail: "GitHub, coding practice and certificates feed your score.",
      auto: connectionState.isComplete,
    },
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
