export interface HomeworkImage {
  uri: string;
  width: number;
  height: number;
}

export interface SelectedProblem {
  imageUri: string;
  problemArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SolutionStep {
  id: string;
  title: string;
  equation?: string; // The mathematical work (formatted for display)
  rawEquation?: string; // The raw equation before formatting (for FormalStepsBox)
  content?: string; // Legacy field, kept for backwards compatibility
  summary?: string; // Plain English explanation
  explanation?: string; // Detailed explanation for simplified mode
  latex?: string;
  code?: string;
}

export interface HomeworkSolution {
  problem: string;
  steps: SolutionStep[];
  finalAnswer: string | { parts: string[] }; // Support both old string format and new parts array
}
