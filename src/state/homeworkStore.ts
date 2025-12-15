import { create } from "zustand";
import { HomeworkImage, HomeworkSolution, SelectedProblem } from "../types/homework";

interface HomeworkState {
  currentImage: HomeworkImage | null;
  selectedProblem: SelectedProblem | null;
  currentSolution: HomeworkSolution | null;
  isAnalyzing: boolean;

  // Actions
  setCurrentImage: (image: HomeworkImage | null) => void;
  setSelectedProblem: (problem: SelectedProblem | null) => void;
  setCurrentSolution: (solution: HomeworkSolution | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  reset: () => void;
}

export const useHomeworkStore = create<HomeworkState>((set) => ({
  currentImage: null,
  selectedProblem: null,
  currentSolution: null,
  isAnalyzing: false,

  setCurrentImage: (image) => set({ currentImage: image }),
  setSelectedProblem: (problem) => set({ selectedProblem: problem }),
  setCurrentSolution: (solution) => set({ currentSolution: solution }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  reset: () => set({
    currentImage: null,
    selectedProblem: null,
    currentSolution: null,
    isAnalyzing: false,
  }),
}));
