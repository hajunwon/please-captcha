import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult } from "../types";
import { PROMPTS } from "../ai/prompts";

export class GridSolver extends BaseSolver {
  canSolve(type: ChallengeType): boolean {
    return type === ChallengeType.GRID_SELECT;
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    const prompt = PROMPTS[ChallengeType.GRID_SELECT];
    const cellCount =
      data.gridCells?.length ??
      (data.gridDimensions
        ? data.gridDimensions.rows * data.gridDimensions.cols
        : 9);

    // Strategy: send individual cells for better accuracy
    const images = data.gridCells?.length
      ? data.gridCells
      : [data.fullScreenshot];

    const userPrompt = prompt.user(data.promptText, { cellCount });
    this.log.info(`Grid solve: "${data.promptText}" (${cellCount} cells)`);

    const response = await this.ai.analyzeImage({
      images,
      prompt: userPrompt,
      systemPrompt: prompt.system,
      model: this.model,
    });

    const indices = this.ai.parseJsonFromResponse<number[]>(response);

    if (!indices || !Array.isArray(indices)) {
      this.log.warn("Failed to parse grid response:", response);
      return {
        type: ChallengeType.GRID_SELECT,
        selectedIndices: [],
        confidence: 0,
      };
    }

    // Filter valid indices
    const valid = indices.filter((i) => i >= 0 && i < cellCount);
    this.log.info("Selected cells:", valid);

    return {
      type: ChallengeType.GRID_SELECT,
      selectedIndices: valid,
      confidence: valid.length > 0 ? 0.8 : 0.2,
    };
  }
}
