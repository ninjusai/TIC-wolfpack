/** Types for the interview-guided project intake flow */

export type InterviewStage =
  | "problem_discovery"
  | "user_identification"
  | "scope_definition"
  | "constraints"
  | "success_criteria"
  | "prior_art"
  | "complete";

export interface InterviewSession {
  sessionId: string;
  projectSlug: string;
  status: "in_progress" | "paused" | "complete" | "abandoned";
  currentStage: InterviewStage;
  turnCount: number;
  startedAt: string;
  updatedAt: string;
}

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  stage?: InterviewStage;
}

export interface InterviewResponse {
  sessionId: string;
  stage: InterviewStage;
  fieldName: string;
  question: string;
  response: string;
  turnNumber: number;
}

export interface StageInfo {
  id: InterviewStage;
  label: string;
  question: string;
  fieldName: string;
}

/** Stage definitions with questions and metadata */
export const INTERVIEW_STAGES: StageInfo[] = [
  {
    id: "problem_discovery",
    label: "Problem Discovery",
    question:
      "What problem are you trying to solve? Tell me what's broken, missing, or painful today.",
    fieldName: "problem",
  },
  {
    id: "user_identification",
    label: "User Identification",
    question:
      "Who will use this? What specific role or job function, and what will they need to accomplish?",
    fieldName: "users",
  },
  {
    id: "scope_definition",
    label: "Scope Definition",
    question:
      "What must be included in the first version? And what should we explicitly exclude for now?",
    fieldName: "scope",
  },
  {
    id: "constraints",
    label: "Constraints",
    question:
      "Are there any technical constraints, timeline pressures, or dependencies I should know about?",
    fieldName: "constraints",
  },
  {
    id: "success_criteria",
    label: "Success Criteria",
    question:
      "How will you know this is working? What's a measurable outcome that proves the problem is solved?",
    fieldName: "successCriteria",
  },
  {
    id: "prior_art",
    label: "Prior Art",
    question:
      "Is there anything existing - code, documentation, tools, or prior attempts - that this builds on or replaces? (Optional - say 'none' if starting fresh)",
    fieldName: "priorArt",
  },
];

/** Get stage index (0-based) */
export const getStageIndex = (stage: InterviewStage): number => {
  if (stage === "complete") return INTERVIEW_STAGES.length;
  return INTERVIEW_STAGES.findIndex((s) => s.id === stage);
};

/** Get stage by index */
export const getStageByIndex = (index: number): StageInfo | undefined => {
  return INTERVIEW_STAGES[index];
};

/** Get next stage */
export const getNextStage = (current: InterviewStage): InterviewStage => {
  const currentIndex = getStageIndex(current);
  if (currentIndex >= INTERVIEW_STAGES.length - 1) return "complete";
  return INTERVIEW_STAGES[currentIndex + 1].id;
};

/** Check if stage is the last one before completion */
export const isLastStage = (stage: InterviewStage): boolean => {
  return stage === "prior_art";
};
