import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult, DragAction } from "../types";
import { PROMPTS } from "../ai/prompts";

export class DragDropSolver extends BaseSolver {
  canSolve(type: ChallengeType): boolean {
    return type === ChallengeType.DRAG_DROP;
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    const prompt = PROMPTS[ChallengeType.DRAG_DROP];
    const image = data.challengeImage ?? data.fullScreenshot;

    this.log.info(`Drag-drop solve: "${data.promptText}"`);

    const response = await this.ai.analyzeImage({
      images: [image],
      prompt: prompt.user(data.promptText),
      systemPrompt: prompt.system,
      model: this.model,
      maxTokens: 512,
    });

    const actions = this.ai.parseJsonFromResponse<DragAction[]>(response);

    if (actions && Array.isArray(actions) && actions.length > 0) {
      const valid = actions.filter(
        (a) =>
          a.from &&
          a.to &&
          typeof a.from.x === "number" &&
          typeof a.to.x === "number",
      );
      this.log.info(`Drag actions: ${valid.length}`);
      return {
        type: ChallengeType.DRAG_DROP,
        dragActions: valid,
        confidence: valid.length > 0 ? 0.7 : 0.2,
      };
    }

    this.log.warn("Failed to parse drag-drop response:", response);
    return {
      type: ChallengeType.DRAG_DROP,
      dragActions: [],
      confidence: 0,
    };
  }
}
